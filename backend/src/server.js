import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import pool from './database.js'

const app = express()
const port = 3000

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

app.get('/transactions', async (request, response) => {
  try {
    const result = await pool.query(`
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
    const result = await pool.query(
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
    const result = await pool.query(
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
    const result = await pool.query(
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

app.listen(port, () => {
  console.log(`FinanTec API running on http://localhost:${port}`)
})