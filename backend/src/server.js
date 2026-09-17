import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'

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

  const [year, month, day] = date.split('-').map(Number)
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  )
}

const transactions = [
  {
    id: 'sample-1',
    date: '2026-07-10',
    description: 'Bolsa de estágio',
    category: 'Trabalho',
    type: 'income',
    amountInCents: 150000,
  },
  {
    id: 'sample-2',
    date: '2026-07-15',
    description: 'Compra no mercado',
    category: 'Alimentação',
    type: 'expense',
    amountInCents: 8590,
  },
]

app.get('/health', (request, response) => {
  response.json({
    status: 'ok',
  })
})

app.get('/transactions', (request, response) => {
  response.json(transactions)
})

app.post('/transactions', (request, response) => {
  const { date, description, category, type, amountInCents } = request.body

  const normalizedDescription =
    typeof description === 'string' ? description.trim() : ''

  const normalizedCategory =
    typeof category === 'string' ? category.trim() : ''

  if (typeof date !== 'string' || !isValidDate(date)) {
    return response.status(400).json({
      error: 'Informe uma data válida.',
    })
  }

  if (!normalizedDescription) {
  return response.status(400).json({
    error: 'Informe uma descrição válida.',
  })
}

  if (!normalizedCategory) {
  return response.status(400).json({
    error: 'Informe uma categoria válida.',
  })
}

  if (!['income', 'expense'].includes(type)) {
    return response.status(400).json({
      error: 'Informe um tipo válido.',
    })
  }

  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return response.status(400).json({
      error: 'Informe um valor positivo dentro do limite permitido.',
    })
  }

  const newTransaction = {
    id: randomUUID(),
    date,
    description: normalizedDescription,
    category: normalizedCategory,
    type,
    amountInCents,
  }

  transactions.unshift(newTransaction)

  return response.status(201).json(newTransaction)
})

app.listen(port, () => {
  console.log(`FinanTec API running on http://localhost:${port}`)
})