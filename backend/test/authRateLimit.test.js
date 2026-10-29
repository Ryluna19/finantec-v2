import { after, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { syncBuiltinESMExports } from 'node:module'
import request from 'supertest'

// O helper captura scrypt ao ser importado; o spy mantém a implementação real.
const scryptSpy = mock.method(crypto, 'scrypt')
syncBuiltinESMExports()
const { createApp } = await import('../src/app.js')
const { hashPassword } = await import('../src/password.js')
after(() => {
  mock.restoreAll()
  syncBuiltinESMExports()
})

const USER = {
  id: '6b959525-67fc-453c-b4b2-956058724f22',
  username: 'Ryan',
}
const CREDENTIALS = { username: 'Ryan', password: 'senha123' }
const passwordHash = await hashPassword(CREDENTIALS.password)
const LIMIT_ERROR = {
  error: 'Muitas tentativas. Aguarde antes de tentar novamente.',
}
const POLICIES = [
  { path: '/auth/login', limit: 15, windowSeconds: 900, successStatus: 200 },
  { path: '/auth/register', limit: 5, windowSeconds: 3600, successStatus: 201 },
]

function createDatabase() {
  return {
    query: mock.fn(async (sql, params) => {
      if (sql.includes('WITH inserted_user')) {
        return { rowCount: 1, rows: [{ id: params[0], username: params[1] }] }
      }
      if (sql.includes('FROM users')) {
        return { rowCount: 1, rows: [{ ...USER, password_hash: passwordHash }] }
      }
      if (sql.includes('INSERT INTO sessions')) {
        return { rowCount: 1, rows: [] }
      }
      if (sql.includes('FROM sessions')) {
        return { rowCount: 1, rows: [USER] }
      }
      if (sql.includes('FROM transactions') || sql.includes('FROM budgets')) {
        return { rowCount: 0, rows: [] }
      }
      throw new Error(`Unexpected database query: ${sql}`)
    }),
  }
}

async function fillLimit(app, path, count) {
  for (let attempt = 0; attempt < count; attempt += 1) {
    const response = await request(app).post(path).send({})
    assert.equal(response.status, 400)
  }
}

function assertRateLimited(response) {
  assert.equal(response.status, 429)
  assert.deepEqual(response.body, LIMIT_ERROR)
  assert.match(response.headers['content-type'], /application\/json/)
  assert.equal(response.headers['set-cookie'], undefined)
}

for (const { path, limit, windowSeconds, successStatus } of POLICIES) {
  test(`${path} allows its quota and blocks before validation, database access or scrypt`, async () => {
    const database = createDatabase()
    const app = createApp({ database })
    const scryptCallsBefore = scryptSpy.mock.callCount()

    await fillLimit(app, path, limit - 1)
    assert.equal(database.query.mock.callCount(), 0)
    assert.equal(scryptSpy.mock.callCount(), scryptCallsBefore)

    const allowed = await request(app).post(path).send(CREDENTIALS)
    assert.equal(allowed.status, successStatus)
    assert.equal(allowed.body.user.username, USER.username)
    assert.ok(allowed.headers['set-cookie'])
    assert.equal(scryptSpy.mock.callCount(), scryptCallsBefore + 1)

    const databaseCalls = database.query.mock.callCount()
    assert.equal(databaseCalls, path === '/auth/login' ? 2 : 1)
    const blocked = await request(app).post(path).send(CREDENTIALS)
    assertRateLimited(blocked)
    assert.match(blocked.headers['ratelimit-policy'], new RegExp(`w=${windowSeconds}(?:;|$)`))
    const retryAfter = Number(blocked.headers['retry-after'])
    assert.ok(retryAfter > 0 && retryAfter <= windowSeconds)

    const malformed = await request(app).post(path)
      .set('Content-Type', 'application/json').send('{')
    assertRateLimited(malformed)
    assert.equal(database.query.mock.callCount(), databaseCalls)
    assert.equal(scryptSpy.mock.callCount(), scryptCallsBefore + 1)

    const otherPath = path === '/auth/login' ? '/auth/register' : '/auth/login'
    const independent = await request(app).post(otherPath).send({})
    assert.equal(independent.status, 400)
  })
}

test('each application instance has independent login and registration counters', async () => {
  const database = createDatabase()
  const firstApp = createApp({ database })
  const secondApp = createApp({ database })

  for (const { path, limit } of POLICIES) {
    await fillLimit(firstApp, path, limit)
    assertRateLimited(await request(firstApp).post(path).send({}))
    const fresh = await request(secondApp).post(path).send({})
    assert.equal(fresh.status, 400)
  }
  assert.equal(database.query.mock.callCount(), 0)
})

test('exhausted public authentication limits do not affect other routes', async () => {
  const app = createApp({ database: createDatabase() })
  for (const { path, limit } of POLICIES) {
    await fillLimit(app, path, limit)
    assertRateLimited(await request(app).post(path).send({}))
  }

  const routes = [
    ['get', '/health', 200],
    ['get', '/auth/me', 200],
    ['post', '/auth/logout', 204],
    ['get', '/transactions', 200],
    ['get', '/budgets', 200],
  ]
  for (const [method, path, status] of routes) {
    const operation = request(app)[method](path)
    if (path !== '/auth/logout') operation.set('Cookie', 'finantec_session=test-session')
    const response = await operation
    assert.equal(response.status, status)
    assert.equal(response.headers.ratelimit, undefined)
    assert.equal(response.headers['retry-after'], undefined)
  }
})

test('changing a client-supplied X-Forwarded-For does not bypass either limit', async (t) => {
  // A biblioteca avisa sobre o header sem proxy confiável; ele é intencional aqui.
  t.mock.method(console, 'error', () => {})
  const database = createDatabase()
  const app = createApp({ database })
  assert.equal(app.get('trust proxy'), false)

  for (const { path, limit } of POLICIES) {
    for (let attempt = 0; attempt < limit; attempt += 1) {
      const response = await request(app).post(path)
        .set('X-Forwarded-For', `203.0.113.${attempt + 1}`)
        .send({ username: `user${attempt}` })
      assert.equal(response.status, 400)
    }
    const blocked = await request(app).post(path)
      .set('X-Forwarded-For', '198.51.100.250').send(CREDENTIALS)
    assertRateLimited(blocked)
  }
  assert.equal(database.query.mock.callCount(), 0)
})
