import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import { hashPassword } from './password.js'
import {
  createSessionToken,
  hashSessionToken,
} from './session.js'

const SESSION_DURATION_IN_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_COOKIE_NAME = 'finantec_session'

export function createApp({ database }) {
  const app = express()

  app.use(
    cors({
      origin: 'http://localhost:5173',
    }),
  )

  app.use(express.json())

  function isValidDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false
    }

    // Confirma que a data existe de fato, além de validar o formato.
    const [year, month, day] = date.split('-').map(Number)
    const parsedDate = new Date(Date.UTC(year, month - 1, day))

    return (
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day
    )
  }

  function isValidUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  }

  function validateRegistrationInput({ username, password } = {}) {
    if (typeof username !== 'string') {
      return {
        error: 'Informe um nome de usuário válido.',
      }
    }

    const normalizedUsername = username.trim()

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 50 ||
      !/^[A-Za-z0-9._-]+$/.test(normalizedUsername)
    ) {
      return {
        error: 'Informe um nome de usuário válido.',
      }
    }

    if (
      typeof password !== 'string' ||
      Array.from(password).length < 8 ||
      Array.from(password).length > 128 ||
      password.trim().length === 0
    ) {
      return {
        error: 'Informe uma senha válida.',
      }
    }

    return {
      registration: {
        username: normalizedUsername,
        password,
      },
    }
  }

  // Cadastro e edição compartilham as mesmas regras de validação.
  function validateTransactionInput({
    date,
    description,
    category,
    type,
    amountInCents,
  } = {}) {
    const normalizedDescription =
      typeof description === 'string' ? description.trim() : ''

    const normalizedCategory =
      typeof category === 'string' ? category.trim() : ''

    if (typeof date !== 'string' || !isValidDate(date)) {
      return {
        error: 'Informe uma data válida.',
      }
    }

    if (!normalizedDescription) {
      return {
        error: 'Informe uma descrição válida.',
      }
    }

    if (!normalizedCategory) {
      return {
        error: 'Informe uma categoria válida.',
      }
    }

    if (!['income', 'expense'].includes(type)) {
      return {
        error: 'Informe um tipo válido.',
      }
    }

    if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
      return {
        error: 'Informe um valor positivo dentro do limite permitido.',
      }
    }

    return {
      transaction: {
        date,
        description: normalizedDescription,
        category: normalizedCategory,
        type,
        amountInCents,
      },
    }
  }

  app.get('/health', (request, response) => {
    return response.json({
      status: 'ok',
    })
  })

    app.post('/auth/register', async (request, response) => {
    const validation = validateRegistrationInput(request.body)

    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
      })
    }

    const { username, password } = validation.registration

    try {
      const userId = randomUUID()
      const passwordHash = await hashPassword(password)

      const sessionToken = createSessionToken()
      const sessionTokenHash = hashSessionToken(sessionToken)
      const expiresAt = new Date(Date.now() + SESSION_DURATION_IN_MS)

      const result = await database.query(
        `
          WITH inserted_user AS (
            INSERT INTO users (
              id,
              username,
              password_hash
            )
            VALUES ($1, $2, $3)
            RETURNING id, username
          ),
          inserted_session AS (
            INSERT INTO sessions (
              token_hash,
              user_id,
              expires_at
            )
            SELECT
              $4,
              id,
              $5
            FROM inserted_user
            RETURNING user_id
          )
          SELECT
            inserted_user.id,
            inserted_user.username
          FROM inserted_user
          INNER JOIN inserted_session
            ON inserted_session.user_id = inserted_user.id
        `,
        [
          userId,
          username,
          passwordHash,
          sessionTokenHash,
          expiresAt,
        ],
      )

      const user = result.rows[0]

      response.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        path: '/',
      })

      return response.status(201).json({
        user: {
          id: user.id,
          username: user.username,
        },
      })
    } catch (error) {
      if (
        error.code === '23505' &&
        error.constraint === 'idx_users_username_lower'
      ) {
        return response.status(409).json({
          error: 'Nome de usuário já está em uso.',
        })
      }

      console.error('Failed to register user:', error)

      return response.status(500).json({
        error: 'Não foi possível criar a conta.',
      })
    }
  })

  app.get('/transactions', async (request, response) => {
    try {
      const result = await database.query(`
        SELECT
          id,
          to_char(transaction_date, 'YYYY-MM-DD') AS date,
          description,
          category,
          transaction_type AS type,
          amount_in_cents
        FROM transactions
        ORDER BY transaction_date DESC, id DESC
      `)

      // Mantém o formato da API separado dos nomes usados no banco.
      const databaseTransactions = result.rows.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        amountInCents: Number(transaction.amount_in_cents),
      }))

      return response.json(databaseTransactions)
    } catch (error) {
      console.error('Failed to load transactions:', error)

      return response.status(500).json({
        error: 'Não foi possível carregar as transações.',
      })
    }
  })

  app.post('/transactions', async (request, response) => {
    const validation = validateTransactionInput(request.body)

    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
      })
    }

    const {
      date,
      description,
      category,
      type,
      amountInCents,
    } = validation.transaction

    const id = randomUUID()

    try {
      const result = await database.query(
        `
          INSERT INTO transactions (
            id,
            transaction_date,
            transaction_type,
            description,
            category,
            amount_in_cents
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING
            id,
            to_char(transaction_date, 'YYYY-MM-DD') AS date,
            description,
            category,
            transaction_type AS type,
            amount_in_cents
        `,
        [
          id,
          date,
          type,
          description,
          category,
          amountInCents,
        ],
      )

      const transaction = result.rows[0]

      return response.status(201).json({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        amountInCents: Number(transaction.amount_in_cents),
      })
    } catch (error) {
      console.error('Failed to create transaction:', error)

      return response.status(500).json({
        error: 'Não foi possível cadastrar a transação.',
      })
    }
  })

  app.put('/transactions/:id', async (request, response) => {
    const { id } = request.params

    if (!isValidUuid(id)) {
      return response.status(400).json({
        error: 'Identificador de transação inválido.',
      })
    }

    const validation = validateTransactionInput(request.body)

    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
      })
    }

    const {
      date,
      description,
      category,
      type,
      amountInCents,
    } = validation.transaction

    try {
      const result = await database.query(
        `
          UPDATE transactions
          SET
            transaction_date = $1,
            transaction_type = $2,
            description = $3,
            category = $4,
            amount_in_cents = $5
          WHERE id = $6
          RETURNING
            id,
            to_char(transaction_date, 'YYYY-MM-DD') AS date,
            description,
            category,
            transaction_type AS type,
            amount_in_cents
        `,
        [
          date,
          type,
          description,
          category,
          amountInCents,
          id,
        ],
      )

      if (result.rowCount === 0) {
        return response.status(404).json({
          error: 'Transação não encontrada.',
        })
      }

      const transaction = result.rows[0]

      return response.json({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        category: transaction.category,
        type: transaction.type,
        amountInCents: Number(transaction.amount_in_cents),
      })
    } catch (error) {
      console.error('Failed to update transaction:', error)

      return response.status(500).json({
        error: 'Não foi possível atualizar a transação.',
      })
    }
  })

  app.delete('/transactions/:id', async (request, response) => {
    const { id } = request.params

    if (!isValidUuid(id)) {
      return response.status(400).json({
        error: 'Identificador de transação inválido.',
      })
    }

    try {
      const result = await database.query(
        `
          DELETE FROM transactions
          WHERE id = $1
          RETURNING id
        `,
        [id],
      )

      if (result.rowCount === 0) {
        return response.status(404).json({
          error: 'Transação não encontrada.',
        })
      }

      return response.status(204).send()
    } catch (error) {
      console.error('Failed to delete transaction:', error)

      return response.status(500).json({
        error: 'Não foi possível excluir a transação.',
      })
    }
  })

  return app
}