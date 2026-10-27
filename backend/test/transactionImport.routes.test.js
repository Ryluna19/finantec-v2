import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CSV = [
  'data,tipo,descricao,categoria,valor',
  '2026-10-05,despesa,Mercado,Alimentação,200.00',
].join('\n')

const EXISTING_TRANSACTION = {
  date: '2026-10-05',
  type: 'expense',
  description: 'Mercado',
  category: 'Alimentação',
  amount_in_cents: '20000',
}

function makeImportDatabase({
  existingTransactions = [],
  waitForUserLock = async () => {},
  userExists = true,
  insertError,
} = {}) {
  const calls = []
  let released = false

  const client = {
    async query(sql, params) {
      calls.push({ sql, params })

      if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rowCount: 0, rows: [] }
      }

      if (sql.includes('FROM users') && sql.includes('FOR UPDATE')) {
        await waitForUserLock()
        return {
          rowCount: userExists ? 1 : 0,
          rows: userExists ? [{ id: USER_ID }] : [],
        }
      }

      if (sql.includes('FROM transactions')) {
        return { rowCount: existingTransactions.length, rows: existingTransactions }
      }

      if (sql.includes('INSERT INTO transactions')) {
        if (insertError) throw insertError
        return {
          rowCount: 1,
          rows: [{ id: params[0], ...EXISTING_TRANSACTION }],
        }
      }

      throw new Error(`Unexpected client query: ${sql}`)
    },
    release() { released = true },
  }

  return {
    database: {
      async query(sql) {
        assert.match(sql, /FROM sessions/)
        return { rowCount: 1, rows: [{ id: USER_ID, username: 'Teste' }] }
      },
      async connect() { return client },
    },
    calls,
    wasReleased: () => released,
  }
}

function importCsv(app, includeDuplicates = false) {
  return request(app)
    .post('/transactions/import')
    .set('Cookie', 'finantec_session=test-session')
    .field('includeDuplicates', String(includeDuplicates))
    .field('user_id', '22222222-2222-4222-8222-222222222222')
    .attach('file', Buffer.from(CSV, 'utf8'), 'transacoes.csv')
}

test('CSV import waits for the user lock before reading transactions and skipping duplicates', async () => {
  let releaseLock
  let signalLockRequested
  const pendingLock = new Promise((resolve) => { releaseLock = resolve })
  const lockRequested = new Promise((resolve) => { signalLockRequested = resolve })

  const setup = makeImportDatabase({
    existingTransactions: [EXISTING_TRANSACTION],
    waitForUserLock: () => {
      signalLockRequested()
      return pendingLock
    },
  })
  const operation = importCsv(createApp({ database: setup.database })).then((response) => response)

  try {
    await Promise.race([
      lockRequested,
      operation.then(() => assert.fail('Import completed before acquiring the user lock')),
    ])

    assert.equal(setup.calls.length, 2)
    assert.equal(setup.calls[0].sql, 'BEGIN ISOLATION LEVEL READ COMMITTED')
    assert.match(setup.calls[1].sql, /SELECT\s+id\s+FROM users\s+WHERE id = \$1\s+FOR UPDATE/)
    assert.deepEqual(setup.calls[1].params, [USER_ID])
  } finally {
    releaseLock()
  }

  const response = await operation
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, {
    insertedCount: 0,
    skippedDuplicateCount: 1,
    transactions: [],
  })
  assert.match(setup.calls[2].sql, /FROM transactions\s+WHERE user_id = \$1/)
  assert.deepEqual(setup.calls[2].params, [USER_ID])
  assert.equal(setup.calls[3].sql, 'COMMIT')
  assert.equal(setup.calls.length, 4)
  assert.equal(setup.wasReleased(), true)
})

test('CSV import still inserts intentional duplicates for the authenticated user', async () => {
  const setup = makeImportDatabase({ existingTransactions: [EXISTING_TRANSACTION] })
  const response = await importCsv(createApp({ database: setup.database }), true)

  assert.equal(response.status, 200)
  assert.equal(response.body.insertedCount, 1)
  assert.equal(response.body.skippedDuplicateCount, 0)
  assert.equal(response.body.transactions.length, 1)
  assert.deepEqual(setup.calls[1].params, [USER_ID])
  assert.match(setup.calls[3].sql, /INSERT INTO transactions/)
  assert.equal(setup.calls[3].params[1], USER_ID)
  assert.equal(setup.calls[4].sql, 'COMMIT')
  assert.equal(setup.wasReleased(), true)
})

test('CSV import rolls back and releases the client after an insert failure', async (t) => {
  t.mock.method(console, 'error', () => {})
  const setup = makeImportDatabase({ insertError: new Error('Insert failed') })
  const response = await importCsv(createApp({ database: setup.database }))

  assert.equal(response.status, 500)
  assert.match(setup.calls[1].sql, /FOR UPDATE/)
  assert.match(setup.calls[3].sql, /INSERT INTO transactions/)
  assert.equal(setup.calls[4].sql, 'ROLLBACK')
  assert.equal(setup.calls.some(({ sql }) => sql === 'COMMIT'), false)
  assert.equal(setup.wasReleased(), true)
})

test('CSV import does not continue if the authenticated user disappears before locking', async () => {
  const setup = makeImportDatabase({ userExists: false })
  const response = await importCsv(createApp({ database: setup.database }))

  assert.equal(response.status, 401)
  assert.deepEqual(response.body, { error: 'Sessão inválida ou expirada.' })
  assert.equal(setup.calls[2].sql, 'ROLLBACK')
  assert.equal(setup.calls.length, 3)
  assert.equal(setup.wasReleased(), true)
})
