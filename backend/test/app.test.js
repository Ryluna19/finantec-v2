import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'

import { createApp } from '../src/app.js'
import { hashPassword } from '../src/password.js'
import { hashSessionToken } from '../src/session.js'

function createFakeDatabase(queryImplementation) {
  return {
    query: queryImplementation,
  }
}

const AUTHENTICATED_USER = {
  id: '6b959525-67fc-453c-b4b2-956058724f22',
  username: 'Ryan',
}

const AUTHENTICATED_SESSION_TOKEN = 'valid-session-token'

function createAuthenticatedDatabase(queryImplementation) {
  return createFakeDatabase(async (sql, params) => {
    if (
      sql.includes('FROM sessions') &&
      sql.includes('sessions.expires_at > NOW()')
    ) {
      return {
        rowCount: 1,
        rows: [AUTHENTICATED_USER],
      }
    }

    return queryImplementation(sql, params)
  })
}

test('GET /health returns API status without accessing the database', async () => {
  const database = createFakeDatabase(async () => {
    throw new Error('Database should not be called')
  })

  const app = createApp({
    database,
  })

  const response = await request(app).get('/health')

  assert.equal(response.status, 200)

  assert.deepEqual(response.body, {
    status: 'ok',
  })
})

test('POST /auth/register creates the user and session', async () => {
  let queryCalls = 0
  let receivedSql
  let receivedParams

  const database = createFakeDatabase(async (sql, params) => {
    queryCalls += 1
    receivedSql = sql
    receivedParams = params

    return {
      rowCount: 1,
      rows: [
        {
          id: params[0],
          username: params[1],
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/register')
    .send({
      username: '  Ryan_19  ',
      password: ' senha123 ',
    })

  assert.equal(response.status, 201)

  assert.deepEqual(response.body, {
    user: {
      id: response.body.user.id,
      username: 'Ryan_19',
    },
  })

  assert.match(
    response.body.user.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )

  assert.equal(queryCalls, 1)

  assert.match(receivedSql, /INSERT INTO users/)
  assert.match(receivedSql, /INSERT INTO sessions/)

  assert.equal(receivedParams[0], response.body.user.id)
  assert.equal(receivedParams[1], 'Ryan_19')

  assert.equal(typeof receivedParams[2], 'string')
  assert.match(receivedParams[2], /^scrypt\$v1\$/)
  assert.notEqual(receivedParams[2], ' senha123 ')

  assert.equal(Buffer.isBuffer(receivedParams[3]), true)
  assert.equal(receivedParams[3].length, 32)

  assert.equal(receivedParams[4] instanceof Date, true)

  const cookies = response.headers['set-cookie']

  assert.equal(Array.isArray(cookies), true)
  assert.equal(cookies.length, 1)
  assert.match(cookies[0], /^finantec_session=/)
  assert.match(cookies[0], /HttpOnly/)
  assert.match(cookies[0], /SameSite=Lax/)
  assert.match(cookies[0], /Path=\//)
  assert.match(cookies[0], /Expires=/)
})

test('POST /auth/register rejects invalid input before accessing the database', async () => {
  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    return {
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/register')
    .send({
      username: 'ab',
      password: 'senha123',
    })

  assert.equal(response.status, 400)

  assert.deepEqual(response.body, {
    error: 'Informe um nome de usuário válido.',
  })

  assert.equal(queryCalls, 0)
  assert.equal(response.headers['set-cookie'], undefined)
})

test('POST /auth/register returns 409 when the username is already in use', async () => {
  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    const error = new Error('Duplicate username')
    error.code = '23505'
    error.constraint = 'idx_users_username_lower'

    throw error
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/register')
    .send({
      username: 'Ryan',
      password: 'senha123',
    })

  assert.equal(response.status, 409)

  assert.deepEqual(response.body, {
    error: 'Nome de usuário já está em uso.',
  })

  assert.equal(queryCalls, 1)
  assert.equal(response.headers['set-cookie'], undefined)
})

test('POST /transactions creates a valid transaction', async () => {
  let receivedSql
  let receivedParams

  const database = createAuthenticatedDatabase(async (sql, params) => {
    receivedSql = sql
    receivedParams = params

    return {
      rowCount: 1,
      rows: [
        {
          id: params[0],
          date: '2026-09-21',
          description: 'Bolsa de estágio',
          category: 'Trabalho',
          type: 'income',
          amount_in_cents: '150000',
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/transactions')
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )
    .send({
      date: '2026-09-21',
      description: '  Bolsa de estágio  ',
      category: '  Trabalho  ',
      type: 'income',
      amountInCents: 150000,
      user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })

  assert.equal(response.status, 201)

  assert.match(
    response.body.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )

  assert.deepEqual(response.body, {
    id: response.body.id,
    date: '2026-09-21',
    description: 'Bolsa de estágio',
    category: 'Trabalho',
    type: 'income',
    amountInCents: 150000,
  })

  // Confirma que os valores normalizados são enviados ao banco.
  assert.deepEqual(receivedParams, [
  response.body.id,
  AUTHENTICATED_USER.id,
  '2026-09-21',
  'income',
  'Bolsa de estágio',
  'Trabalho',
  150000,
])

  assert.match(
  receivedSql,
  /INSERT INTO transactions\s*\(\s*id,\s*user_id,\s*transaction_date/,
)

  assert.match(
  receivedSql,
  /VALUES\s*\(\s*\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6,\s*\$7\s*\)/,
)
})

test('POST /auth/login authenticates the user and creates a session', async () => {
  const passwordHash = await hashPassword('senha123')

  let queryCalls = 0
  let loginSql
  let loginParams
  let sessionParams

  const database = createFakeDatabase(async (sql, params) => {
    queryCalls += 1

    if (sql.includes('FROM users')) {
      loginSql = sql
      loginParams = params

      return {
        rowCount: 1,
        rows: [
          {
            id: '6b959525-67fc-453c-b4b2-956058724f22',
            username: 'Ryan',
            password_hash: passwordHash,
          },
        ],
      }
    }

    if (sql.includes('INSERT INTO sessions')) {
      sessionParams = params

      return {
        rowCount: 1,
        rows: [],
      }
    }

    throw new Error('Unexpected database query')
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/login')
    .send({
      username: '  RYAN  ',
      password: 'senha123',
    })

  assert.equal(response.status, 200)

  assert.deepEqual(response.body, {
    user: {
      id: '6b959525-67fc-453c-b4b2-956058724f22',
      username: 'Ryan',
    },
  })

  assert.equal(queryCalls, 2)

  assert.match(
    loginSql,
    /WHERE lower\(username\) = lower\(\$1\)/,
  )

  assert.deepEqual(loginParams, ['RYAN'])

  assert.equal(Buffer.isBuffer(sessionParams[0]), true)
  assert.equal(sessionParams[0].length, 32)

  assert.equal(
    sessionParams[1],
    '6b959525-67fc-453c-b4b2-956058724f22',
  )

  assert.equal(sessionParams[2] instanceof Date, true)

  const cookies = response.headers['set-cookie']

  assert.equal(Array.isArray(cookies), true)
  assert.equal(cookies.length, 1)
  assert.match(cookies[0], /^finantec_session=/)
  assert.match(cookies[0], /HttpOnly/)
  assert.match(cookies[0], /SameSite=Lax/)
  assert.match(cookies[0], /Expires=/)
})

test('POST /auth/login rejects an incorrect password', async () => {
  const passwordHash = await hashPassword('senha123')

  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    return {
      rowCount: 1,
      rows: [
        {
          id: '6b959525-67fc-453c-b4b2-956058724f22',
          username: 'Ryan',
          password_hash: passwordHash,
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/login')
    .send({
      username: 'Ryan',
      password: 'senha999',
    })

  assert.equal(response.status, 401)

  assert.deepEqual(response.body, {
    error: 'Nome de usuário ou senha inválidos.',
  })

  assert.equal(queryCalls, 1)
  assert.equal(response.headers['set-cookie'], undefined)
})

test('POST /auth/login returns the same 401 for an unknown username', async () => {
  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    return {
      rowCount: 0,
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/login')
    .send({
      username: 'UnknownUser',
      password: 'senha123',
    })

  assert.equal(response.status, 401)

  assert.deepEqual(response.body, {
    error: 'Nome de usuário ou senha inválidos.',
  })

  assert.equal(queryCalls, 1)
  assert.equal(response.headers['set-cookie'], undefined)
})

test('GET /auth/me returns the authenticated user for a valid session', async () => {
  const sessionToken = 'valid-session-token'
  const expectedTokenHash = hashSessionToken(sessionToken)

  let queryCalls = 0
  let receivedSql
  let receivedParams

  const database = createFakeDatabase(async (sql, params) => {
    queryCalls += 1
    receivedSql = sql
    receivedParams = params

    return {
      rowCount: 1,
      rows: [
        {
          id: '6b959525-67fc-453c-b4b2-956058724f22',
          username: 'Ryan',
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .get('/auth/me')
    .set(
      'Cookie',
      `finantec_session=${sessionToken}`,
    )

  assert.equal(response.status, 200)

  assert.deepEqual(response.body, {
    user: {
      id: '6b959525-67fc-453c-b4b2-956058724f22',
      username: 'Ryan',
    },
  })

  assert.equal(queryCalls, 1)

  assert.match(receivedSql, /FROM sessions/)
  assert.match(
    receivedSql,
    /sessions\.expires_at > NOW\(\)/,
  )

  assert.equal(Buffer.isBuffer(receivedParams[0]), true)

  assert.equal(
    receivedParams[0].equals(expectedTokenHash),
    true,
  )
})

test('GET /auth/me returns 401 for a missing or invalid session', async () => {
  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    return {
      rowCount: 0,
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const missingSessionResponse = await request(app)
    .get('/auth/me')

  assert.equal(missingSessionResponse.status, 401)

  assert.deepEqual(missingSessionResponse.body, {
    error: 'Sessão inválida ou expirada.',
  })

  assert.equal(queryCalls, 0)

  const invalidSessionResponse = await request(app)
    .get('/auth/me')
    .set(
      'Cookie',
      'finantec_session=invalid-session-token',
    )

  assert.equal(invalidSessionResponse.status, 401)

  assert.deepEqual(invalidSessionResponse.body, {
    error: 'Sessão inválida ou expirada.',
  })

  assert.equal(queryCalls, 1)
})

test('POST /auth/logout revokes the current session and clears the cookie', async () => {
  const sessionToken = 'valid-session-token'
  const expectedTokenHash = hashSessionToken(sessionToken)

  let queryCalls = 0
  let receivedSql
  let receivedParams

  const database = createFakeDatabase(async (sql, params) => {
    queryCalls += 1
    receivedSql = sql
    receivedParams = params

    return {
      rowCount: 1,
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/logout')
    .set(
      'Cookie',
      `finantec_session=${sessionToken}`,
    )

  assert.equal(response.status, 204)
  assert.equal(response.text, '')

  assert.equal(queryCalls, 1)
  assert.match(receivedSql, /DELETE FROM sessions/)

  assert.equal(Buffer.isBuffer(receivedParams[0]), true)

  assert.equal(
    receivedParams[0].equals(expectedTokenHash),
    true,
  )

  const cookies = response.headers['set-cookie']

  assert.equal(Array.isArray(cookies), true)
  assert.equal(cookies.length, 1)
  assert.match(cookies[0], /^finantec_session=/)
  assert.match(cookies[0], /HttpOnly/)
  assert.match(cookies[0], /SameSite=Lax/)
  assert.match(cookies[0], /Path=\//)
})

test('POST /auth/logout succeeds without a session cookie', async () => {
  let queryCalls = 0

  const database = createFakeDatabase(async () => {
    queryCalls += 1

    return {
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/auth/logout')

  assert.equal(response.status, 204)
  assert.equal(response.text, '')

  assert.equal(queryCalls, 0)

  const cookies = response.headers['set-cookie']

  assert.equal(Array.isArray(cookies), true)
  assert.equal(cookies.length, 1)
  assert.match(cookies[0], /^finantec_session=/)
})

test('transaction routes require authentication', async () => {
  const database = createFakeDatabase(async () => {
    throw new Error('Database should not be called')
  })

  const app = createApp({
    database,
  })

  const routes = [
    ['get', '/transactions'],
    ['post', '/transactions'],
    [
      'put',
      '/transactions/6b959525-67fc-453c-b4b2-956058724f22',
    ],
    [
      'delete',
      '/transactions/6b959525-67fc-453c-b4b2-956058724f22',
    ],
  ]

  for (const [method, path] of routes) {
    const response = await request(app)[method](path)

    assert.equal(response.status, 401)

    assert.deepEqual(response.body, {
      error: 'Sessão inválida ou expirada.',
    })
  }
})

test('POST /transactions rejects a request without a body', async () => {
  let queryCalls = 0

  const database = createAuthenticatedDatabase(async () => {
    queryCalls += 1

    return {
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .post('/transactions')
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )

  assert.equal(response.status, 400)

  assert.deepEqual(response.body, {
    error: 'Informe uma data válida.',
  })

  // Entrada inválida deve ser rejeitada antes da query de transação.
  assert.equal(queryCalls, 0)
})

test('GET /transactions returns transactions using the API format', async () => {
  let receivedSql
  let receivedParams

  const database = createAuthenticatedDatabase(async (sql, params) => {
  receivedSql = sql
  receivedParams = params

    return {
      rows: [
        {
          id: '6b959525-67fc-453c-b4b2-956058724f22',
          date: '2026-09-21',
          description: 'Mercado',
          category: 'Alimentação',
          type: 'expense',
          amount_in_cents: '8590',
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .get('/transactions')
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )

  assert.equal(response.status, 200)

  assert.deepEqual(response.body, [
    {
      id: '6b959525-67fc-453c-b4b2-956058724f22',
      date: '2026-09-21',
      description: 'Mercado',
      category: 'Alimentação',
      type: 'expense',
      amountInCents: 8590,
    },
  ])

  assert.match(
    receivedSql,
    /ORDER BY transaction_date DESC, id DESC/,
  )
  assert.match(
    receivedSql,
    /WHERE user_id = \$1/,
  )

  assert.deepEqual(receivedParams, [
    AUTHENTICATED_USER.id,
  ])
})

test('PUT /transactions/:id updates an existing transaction and preserves its id', async () => {
  const id = '6b959525-67fc-453c-b4b2-956058724f22'

  let receivedSql
  let receivedParams

  const database = createAuthenticatedDatabase(async (sql, params) => {
    receivedSql = sql
    receivedParams = params

    return {
      rowCount: 1,
      rows: [
        {
          id,
          date: '2026-09-22',
          description: 'Salário atualizado',
          category: 'Trabalho',
          type: 'income',
          amount_in_cents: '500000',
        },
      ],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .put(`/transactions/${id}`)
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )
    .send({
      date: '2026-09-22',
      description: '  Salário atualizado  ',
      category: '  Trabalho  ',
      type: 'income',
      amountInCents: 500000,
    })

  assert.equal(response.status, 200)

  assert.deepEqual(response.body, {
    id,
    date: '2026-09-22',
    description: 'Salário atualizado',
    category: 'Trabalho',
    type: 'income',
    amountInCents: 500000,
  })

  assert.deepEqual(receivedParams, [
    '2026-09-22',
    'income',
    'Salário atualizado',
    'Trabalho',
    500000,
    id,
    AUTHENTICATED_USER.id,
  ])
  assert.match(
    receivedSql,
    /WHERE id = \$6\s+AND user_id = \$7/,
  )
})

test('PUT /transactions/:id returns 404 when the transaction does not exist', async () => {
  const id = '6b959525-67fc-453c-b4b2-956058724f22'

  let queryCalls = 0

  const database = createAuthenticatedDatabase(async () => {
    queryCalls += 1

    return {
      rowCount: 0,
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const response = await request(app)
    .put(`/transactions/${id}`)
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )
    .send({
      date: '2026-09-22',
      description: 'Teste',
      category: 'Teste',
      type: 'expense',
      amountInCents: 1000,
    })

  assert.equal(response.status, 404)

  assert.deepEqual(response.body, {
    error: 'Transação não encontrada.',
  })

  // Um update inexistente não deve tentar criar uma nova transação.
  assert.equal(queryCalls, 1)
})

test('DELETE /transactions/:id handles existing and missing transactions', async () => {
  const id = '6b959525-67fc-453c-b4b2-956058724f22'

  let transactionExists = true
  let receivedSql
  const receivedParams = []

  const database = createAuthenticatedDatabase(async (sql, params) => {
    receivedSql = sql
    receivedParams.push(params)

    if (transactionExists) {
      transactionExists = false

      return {
        rowCount: 1,
        rows: [{ id }],
      }
    }

    return {
      rowCount: 0,
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const firstResponse = await request(app)
    .delete(`/transactions/${id}`)
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )

  assert.equal(firstResponse.status, 204)
  assert.equal(firstResponse.text, '')

  const secondResponse = await request(app)
    .delete(`/transactions/${id}`)
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )

  assert.equal(secondResponse.status, 404)

  assert.deepEqual(secondResponse.body, {
    error: 'Transação não encontrada.',
  })

  assert.deepEqual(receivedParams, [
    [id, AUTHENTICATED_USER.id],
    [id, AUTHENTICATED_USER.id],
  ])

  assert.match(
    receivedSql,
    /WHERE id = \$1\s+AND user_id = \$2/,
  )
})

test('PUT and DELETE reject an invalid UUID before accessing the database', async () => {
  let queryCalls = 0

  const database = createAuthenticatedDatabase(async () => {
    queryCalls += 1

    return {
      rows: [],
    }
  })

  const app = createApp({
    database,
  })

  const putResponse = await request(app)
    .put('/transactions/abc')
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )
    .send({
      date: '2026-09-22',
      description: 'Teste',
      category: 'Teste',
      type: 'expense',
      amountInCents: 1000,
    })

  const deleteResponse = await request(app)
    .delete('/transactions/abc')
    .set(
      'Cookie',
      `finantec_session=${AUTHENTICATED_SESSION_TOKEN}`,
    )

  assert.equal(putResponse.status, 400)
  assert.equal(deleteResponse.status, 400)

  assert.deepEqual(putResponse.body, {
    error: 'Identificador de transação inválido.',
  })

  assert.deepEqual(deleteResponse.body, {
    error: 'Identificador de transação inválido.',
  })

  // UUID inválido deve ser bloqueado antes de queries de transação.
  assert.equal(queryCalls, 0)
})