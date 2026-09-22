
import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'

function createFakeDatabase(queryImplementation) {
  return {
    query: queryImplementation,
  }
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

test('POST /transactions creates a valid transaction', async () => {
  let receivedSql
  let receivedParams

  const database = createFakeDatabase(async (sql, params) => {
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
    .send({
      date: '2026-09-21',
      description: '  Bolsa de estágio  ',
      category: '  Trabalho  ',
      type: 'income',
      amountInCents: 150000,
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
    '2026-09-21',
    'income',
    'Bolsa de estágio',
    'Trabalho',
    150000,
  ])

  assert.match(receivedSql, /INSERT INTO transactions/)
})

test('POST /transactions rejects a request without a body', async () => {
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

  const response = await request(app).post('/transactions')

  assert.equal(response.status, 400)
  assert.deepEqual(response.body, {
    error: 'Informe uma data válida.',
  })

  // Entrada inválida deve ser rejeitada antes de acessar o banco.
  assert.equal(queryCalls, 0)
})

test('GET /transactions returns transactions using the API format', async () => {
  let receivedSql

  const database = createFakeDatabase(async (sql) => {
    receivedSql = sql

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

  const response = await request(app).get('/transactions')

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
})

test('PUT /transactions/:id updates an existing transaction and preserves its id', async () => {
  const id = '6b959525-67fc-453c-b4b2-956058724f22'

  let receivedParams

  const database = createFakeDatabase(async (sql, params) => {
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
  ])
})

test('PUT /transactions/:id returns 404 when the transaction does not exist', async () => {
  const id = '6b959525-67fc-453c-b4b2-956058724f22'

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
    .put(`/transactions/${id}`)
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
  const receivedParams = []

  const database = createFakeDatabase(async (sql, params) => {
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

  assert.equal(firstResponse.status, 204)
  assert.equal(firstResponse.text, '')

  const secondResponse = await request(app)
    .delete(`/transactions/${id}`)

  assert.equal(secondResponse.status, 404)

  assert.deepEqual(secondResponse.body, {
    error: 'Transação não encontrada.',
  })

  assert.deepEqual(receivedParams, [
    [id],
    [id],
  ])
})

test('PUT and DELETE reject an invalid UUID before accessing the database', async () => {
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

  const putResponse = await request(app)
    .put('/transactions/abc')
    .send({
      date: '2026-09-22',
      description: 'Teste',
      category: 'Teste',
      type: 'expense',
      amountInCents: 1000,
    })

  const deleteResponse = await request(app)
    .delete('/transactions/abc')

  assert.equal(putResponse.status, 400)
  assert.equal(deleteResponse.status, 400)

  assert.deepEqual(putResponse.body, {
    error: 'Identificador de transação inválido.',
  })

  assert.deepEqual(deleteResponse.body, {
    error: 'Identificador de transação inválido.',
  })

  // UUID inválido deve ser bloqueado antes de qualquer consulta.
  assert.equal(queryCalls, 0)
})