import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { hashSessionToken } from '../src/session.js'

const databaseUrl = process.env.FINANTEC_TEST_DATABASE_URL
const CSV = [
  'data,tipo,descricao,categoria,valor',
  '2026-10-05,despesa,Mercado,Alimentação,200.00',
].join('\n')

test('CSV import concurrency against an isolated PostgreSQL', {
  skip: !databaseUrl,
  timeout: 30000,
}, async (t) => {
  const url = new URL(databaseUrl)
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal(url.pathname, '/finantec_import_test')

  const schema = `import_test_${randomUUID().replaceAll('-', '')}`
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${schema},public`,
    application_name: schema,
    max: 6,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  })
  let schemaCreated = false

  t.after(async () => {
    try {
      if (schemaCreated) {
        await pool.query(`DROP SCHEMA ${schema} CASCADE`)
      }
    } finally {
      await pool.end()
    }
  })

  const metadata = await pool.query('SELECT current_database() AS name')
  assert.equal(metadata.rows[0].name, 'finantec_import_test')
  await pool.query(`CREATE SCHEMA ${schema}`)
  schemaCreated = true

  for (const migration of ['001_create_transactions.sql', '002_create_users_and_sessions.sql']) {
    await pool.query(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'))
  }

  const app = createApp({ database: pool })

  async function createUser() {
    const id = randomUUID()
    const token = randomUUID()
    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [id, `test-${id}`, 'unused-in-session-tests'],
    )
    await pool.query(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')",
      [hashSessionToken(token), id],
    )
    return { id, token }
  }

  function importCsv(user, includeDuplicates) {
    return request(app)
      .post('/transactions/import')
      .set('Cookie', `finantec_session=${user.token}`)
      .field('includeDuplicates', String(includeDuplicates))
      .attach('file', Buffer.from(CSV, 'utf8'), 'transacoes.csv')
      .then((response) => response)
  }

  async function holdUserLock(user) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id])
      return client
    } catch (error) {
      client.release(error)
      throw error
    }
  }

  async function waitForBlockedImports(count) {
    const deadline = Date.now() + 5000

    while (Date.now() < deadline) {
      const result = await pool.query(
        `SELECT count(*)::int AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND application_name = $1
           AND wait_event_type = 'Lock'
           AND query LIKE '%FROM users%'
           AND query LIKE '%FOR UPDATE%'`,
        [schema],
      )
      if (result.rows[0].count === count) return
      await setTimeout(10)
    }

    assert.fail(`Expected ${count} import request(s) waiting for a user row lock`)
  }

  for (const includeDuplicates of [false, true]) {
    await t.test(`simultaneous imports with includeDuplicates=${includeDuplicates}`, async () => {
      const user = await createUser()
      const blocker = await holdUserLock(user)
      const operations = [importCsv(user, includeDuplicates), importCsv(user, includeDuplicates)]

      try {
        await waitForBlockedImports(2)
        await blocker.query('COMMIT')
        const responses = await Promise.all(operations)

        assert.deepEqual(responses.map((response) => response.status), [200, 200])
        assert.deepEqual(
          responses.map((response) => response.body.insertedCount).sort(),
          includeDuplicates ? [1, 1] : [0, 1],
        )
        assert.deepEqual(
          responses.map((response) => response.body.skippedDuplicateCount).sort(),
          includeDuplicates ? [0, 0] : [0, 1],
        )
        const persisted = await pool.query(
          'SELECT count(*)::int AS count FROM transactions WHERE user_id = $1', [user.id],
        )
        assert.equal(persisted.rows[0].count, includeDuplicates ? 2 : 1)
      } finally {
        await blocker.query('ROLLBACK')
        blocker.release()
        await Promise.allSettled(operations)
      }
    })
  }

  await t.test('a blocked import does not prevent another user from importing', async () => {
    const userA = await createUser()
    const userB = await createUser()
    const blocker = await holdUserLock(userA)
    const operationA = importCsv(userA, false)

    try {
      await waitForBlockedImports(1)
      const responseB = await importCsv(userB, false)
      assert.equal(responseB.status, 200)
      assert.equal(responseB.body.insertedCount, 1)
      await waitForBlockedImports(1)

      const persisted = await pool.query(
        'SELECT user_id FROM transactions ORDER BY user_id',
      )
      assert.equal(persisted.rows.filter((row) => row.user_id === userA.id).length, 0)
      assert.equal(persisted.rows.filter((row) => row.user_id === userB.id).length, 1)
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
      await Promise.allSettled([operationA])
    }

    const responseA = await operationA
    assert.equal(responseA.status, 200)
    assert.equal(responseA.body.insertedCount, 1)
  })
})
