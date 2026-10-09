import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import { hashPassword, verifyPassword } from './password.js'
import {
  createSessionToken,
  hashSessionToken,
} from './session.js'
import { validateTransactionInput } from './transactionValidation.js'
import {
  isValidBudgetPeriod,
  validateBudgetInput,
} from './budgetValidation.js'
import multer from 'multer'

import {
  buildTransactionImportPreview,
  parseCanonicalTransactionCsv,
  splitTransactionsByDuplicateMatch,
} from './transactionImport.js'

const SESSION_DURATION_IN_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_COOKIE_NAME = 'finantec_session'
const MAX_TRANSACTION_IMPORT_FILE_SIZE =
2 * 1024 * 1024

const MAX_TRANSACTION_IMPORT_ROWS = 5000

const transactionImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:
    MAX_TRANSACTION_IMPORT_FILE_SIZE,
    files: 1,
  },
})

function receiveTransactionImportFile(
  request,
  response,
  next,
) {
  transactionImportUpload.single('file')(
    request,
    response,
    (error) => {
      if (!error) {
        return next()
      }
      if (
        error instanceof multer.MulterError &&
        error.code === 'LIMIT_FILE_SIZE'
      ) {
        return response.status(413).json({
          error:
          'O arquivo CSV excede o limite de 2 MB.',
        })
      }
      if (error instanceof multer.MulterError) {
        return response.status(400).json({
          error:
          'Não foi possível receber o arquivo CSV.',
        })
      }
      return response.status(400).json({
        error:
        'Não foi possível receber o arquivo CSV.',
      })
    },
  )
}

function parseTransactionImportFile(file) {
  if (!file) {
    return {
      status: 400,
      error:
      'Selecione um arquivo CSV para importar.',
    }
  }

  if (
    !file.originalname
    .toLowerCase()
    .endsWith('.csv')
  ) {
    return {
      status: 415,
      error:
      'Formato não suportado. Envie um arquivo CSV.',
    }
  }

  let csvContent

  try {
    csvContent = new TextDecoder(
      'utf-8',
      {
        fatal: true,
      },
    ).decode(file.buffer)
  } catch {
    return {
      status: 400,
      error:
      'O arquivo CSV precisa estar em UTF-8.',
    }
  }

  let parsedImport

  try {
    parsedImport =
    parseCanonicalTransactionCsv(
      csvContent,
    )
  } catch (error) {
    return {
      status: 400,
      error:
      error instanceof Error
      ? error.message
      : 'Não foi possível interpretar o arquivo CSV.',
    }
  }

  if (
    parsedImport.totalRows >
    MAX_TRANSACTION_IMPORT_ROWS
  ) {
    return {
      status: 413,
      error:
      'O arquivo CSV excede o limite de 5.000 registros.',
    }
  }

  return {
    parsedImport,
  }
}

function parseIncludeDuplicates(value) {
  if (
    value === undefined ||
    value === 'false'
  ) {
    return {
      includeDuplicates: false,
    }
  }

  if (value === 'true') {
    return {
      includeDuplicates: true,
    }
  }

  return {
    error:
    'A opção de duplicatas deve ser true ou false.',
  }
}

export function createApp({ database }) {
  const app = express()

  app.use(
    cors({
      origin: 'http://localhost:5173',
      credentials: true,
    }),
  )

  app.use(express.json())

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

  function validateLoginInput({ username, password } = {}) {
    if (
      typeof username !== 'string' ||
      typeof password !== 'string'
    ) {
      return {
        error: 'Informe nome de usuário e senha.',
      }
    }

    const normalizedUsername = username.trim()

    const credentialsAreValid =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 50 &&
    /^[A-Za-z0-9._-]+$/.test(normalizedUsername) &&
    Array.from(password).length >= 8 &&
    Array.from(password).length <= 128 &&
    password.trim().length > 0

    return {
      login: {
        username: normalizedUsername,
        password,
        credentialsAreValid,
      },
    }
  }

  function getCookieValue(request, cookieName) {
    const cookieHeader = request.headers.cookie

    if (typeof cookieHeader !== 'string') {
      return null
    }

    const cookies = cookieHeader.split(';')

    for (const cookie of cookies) {
      const separatorIndex = cookie.indexOf('=')

      if (separatorIndex === -1) {
        continue
      }

      const name = cookie.slice(0, separatorIndex).trim()

      if (name === cookieName) {
        return cookie.slice(separatorIndex + 1)
      }
    }

    return null
  }

  async function requireAuthentication(request, response, next) {
    const sessionToken = getCookieValue(
      request,
      SESSION_COOKIE_NAME,
    )

    if (!sessionToken) {
      return response.status(401).json({
        error: 'Sessão inválida ou expirada.',
      })
    }

    try {
      const sessionTokenHash = hashSessionToken(sessionToken)

      const result = await database.query(
        `
          SELECT
            users.id,
            users.username
          FROM sessions
          INNER JOIN users
            ON users.id = sessions.user_id
          WHERE sessions.token_hash = $1
            AND sessions.expires_at > NOW()
        `,
        [sessionTokenHash],
      )

      if (result.rowCount === 0) {
        return response.status(401).json({
          error: 'Sessão inválida ou expirada.',
        })
      }

      request.user = {
        id: result.rows[0].id,
        username: result.rows[0].username,
      }

      return next()
    } catch (error) {
      console.error('Failed to authenticate session:', error)

      return response.status(500).json({
        error: 'Não foi possível verificar a sessão.',
      })
    }
  }

  // Cadastro e edição compartilham as mesmas regras de validação.

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

  app.post('/auth/login', async (request, response) => {
    const validation = validateLoginInput(request.body)

    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
      })
    }

    const {
      username,
      password,
      credentialsAreValid,
    } = validation.login

    if (!credentialsAreValid) {
      return response.status(401).json({
        error: 'Nome de usuário ou senha inválidos.',
      })
    }

    try {
      const result = await database.query(
        `
          SELECT
            id,
            username,
            password_hash
          FROM users
          WHERE lower(username) = lower($1)
        `,
        [username],
      )

      if (result.rowCount === 0) {
        return response.status(401).json({
          error: 'Nome de usuário ou senha inválidos.',
        })
      }

      const user = result.rows[0]

      const passwordIsValid = await verifyPassword(
        password,
        user.password_hash,
      )

      if (!passwordIsValid) {
        return response.status(401).json({
          error: 'Nome de usuário ou senha inválidos.',
        })
      }

      const sessionToken = createSessionToken()
      const sessionTokenHash = hashSessionToken(sessionToken)
      const expiresAt = new Date(Date.now() + SESSION_DURATION_IN_MS)

      await database.query(
        `
          INSERT INTO sessions (
            token_hash,
            user_id,
            expires_at
          )
          VALUES ($1, $2, $3)
        `,
        [
          sessionTokenHash,
          user.id,
          expiresAt,
        ],
      )

      response.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        expires: expiresAt,
        path: '/',
      })

      return response.json({
        user: {
          id: user.id,
          username: user.username,
        },
      })
    } catch (error) {
      console.error('Failed to login user:', error)

      return response.status(500).json({
        error: 'Não foi possível entrar na conta.',
      })
    }
  })
  app.get('/auth/me', requireAuthentication, (request, response) => {
    return response.json({
      user: request.user,
    })
  })

  app.post('/auth/logout', async (request, response) => {
    const sessionToken = getCookieValue(
      request,
      SESSION_COOKIE_NAME,
    )

    if (!sessionToken) {
      response.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      })

      return response.status(204).send()
    }

    try {
      const sessionTokenHash = hashSessionToken(sessionToken)

      await database.query(
        `
          DELETE FROM sessions
          WHERE token_hash = $1
        `,
        [sessionTokenHash],
      )

      response.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      })

      return response.status(204).send()
    } catch (error) {
      console.error('Failed to logout user:', error)

      return response.status(500).json({
        error: 'Não foi possível encerrar a sessão.',
      })
    }
  })

  app.use('/transactions', requireAuthentication)
    app.use('/budgets', requireAuthentication)

  app.get('/budgets', async (request, response) => {
    try {
      const result = await database.query(
        `
          SELECT
            id,
            to_char(
              start_period,
              'YYYY-MM'
            ) AS start_period,
            CASE
              WHEN end_period IS NULL
                THEN NULL
              ELSE to_char(
                end_period,
                'YYYY-MM'
              )
            END AS end_period,
            category,
            planned_amount_in_cents
          FROM budgets
          WHERE user_id = $1
          ORDER BY
            start_period DESC,
            category_key ASC,
            id DESC
        `,
        [request.user.id],
      )

      const budgets = result.rows.map(
        (budget) => ({
          id: budget.id,
          startPeriod: budget.start_period,
          endPeriod: budget.end_period,
          category: budget.category,
          plannedAmountInCents: Number(
            budget.planned_amount_in_cents,
          ),
        }),
      )

      return response.json(budgets)
    } catch (error) {
      console.error(
        'Failed to load budgets:',
        error,
      )

      return response.status(500).json({
        error:
          'Não foi possível carregar os orçamentos.',
      })
    }
  })

  app.post('/budgets', async (request, response) => {
    const validation =
      validateBudgetInput(request.body)

    if (validation.error) {
      return response.status(400).json({
        error: validation.error,
      })
    }

    const {
      startPeriod,
      endPeriod,
      category,
      categoryKey,
      plannedAmountInCents,
    } = validation.budget

    const id = randomUUID()

    const startPeriodDate =
      `${startPeriod}-01`

    const endPeriodDate =
      endPeriod === null
        ? null
        : `${endPeriod}-01`

    try {
      const result = await database.query(
        `
          INSERT INTO budgets (
            id,
            user_id,
            start_period,
            end_period,
            category,
            category_key,
            planned_amount_in_cents
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING
            id,
            to_char(
              start_period,
              'YYYY-MM'
            ) AS start_period,
            CASE
              WHEN end_period IS NULL
                THEN NULL
              ELSE to_char(
                end_period,
                'YYYY-MM'
              )
            END AS end_period,
            category,
            planned_amount_in_cents
        `,
        [
          id,
          request.user.id,
          startPeriodDate,
          endPeriodDate,
          category,
          categoryKey,
          plannedAmountInCents,
        ],
      )

      const budget = result.rows[0]

      return response.status(201).json({
        id: budget.id,
        startPeriod: budget.start_period,
        endPeriod: budget.end_period,
        category: budget.category,
        plannedAmountInCents: Number(
          budget.planned_amount_in_cents,
        ),
      })
    } catch (error) {
      if (
        error?.code === '23P01' &&
        error?.constraint ===
          'budgets_no_overlapping_periods'
      ) {
        return response.status(409).json({
          error:
            'Já existe um orçamento para essa categoria em parte do período informado.',
        })
      }

      console.error(
        'Failed to create budget:',
        error,
      )

      return response.status(500).json({
        error:
          'Não foi possível cadastrar o orçamento.',
      })
    }
  })

  app.put('/budgets/:id', async (request, response) => {
    const { id } = request.params

    if (!isValidUuid(id)) {
      return response.status(400).json({
        error:
          'Identificador de orçamento inválido.',
      })
    }

    try {
      const currentResult =
        await database.query(
          `
            SELECT
              to_char(
                start_period,
                'YYYY-MM'
              ) AS start_period
            FROM budgets
            WHERE id = $1
              AND user_id = $2
          `,
          [
            id,
            request.user.id,
          ],
        )

      if (currentResult.rowCount === 0) {
        return response.status(404).json({
          error: 'Orçamento não encontrado.',
        })
      }

      const validation =
        validateBudgetInput({
          startPeriod:
            currentResult.rows[0].start_period,
          endPeriod:
            request.body?.endPeriod,
          category:
            request.body?.category,
          plannedAmountInCents:
            request.body
              ?.plannedAmountInCents,
        })

      if (validation.error) {
        return response.status(400).json({
          error: validation.error,
        })
      }

      const {
        endPeriod,
        category,
        categoryKey,
        plannedAmountInCents,
      } = validation.budget

      const endPeriodDate =
        endPeriod === null
          ? null
          : `${endPeriod}-01`

      const result =
        await database.query(
          `
            UPDATE budgets
            SET
              end_period = $1,
              category = $2,
              category_key = $3,
              planned_amount_in_cents = $4
            WHERE id = $5
              AND user_id = $6
            RETURNING
              id,
              to_char(
                start_period,
                'YYYY-MM'
              ) AS start_period,
              CASE
                WHEN end_period IS NULL
                  THEN NULL
                ELSE to_char(
                  end_period,
                  'YYYY-MM'
                )
              END AS end_period,
              category,
              planned_amount_in_cents
          `,
          [
            endPeriodDate,
            category,
            categoryKey,
            plannedAmountInCents,
            id,
            request.user.id,
          ],
        )

      if (result.rowCount === 0) {
        return response.status(404).json({
          error: 'Orçamento não encontrado.',
        })
      }

      const budget = result.rows[0]

      return response.json({
        id: budget.id,
        startPeriod: budget.start_period,
        endPeriod: budget.end_period,
        category: budget.category,
        plannedAmountInCents: Number(
          budget.planned_amount_in_cents,
        ),
      })
    } catch (error) {
      if (
        error?.code === '23P01' &&
        error?.constraint ===
          'budgets_no_overlapping_periods'
      ) {
        return response.status(409).json({
          error:
            'Já existe um orçamento para essa categoria em parte do período informado.',
        })
      }

      console.error(
        'Failed to update budget:',
        error,
      )

      return response.status(500).json({
        error:
          'Não foi possível atualizar o orçamento.',
      })
    }
  })

  app.delete(
    '/budgets/:id',
    async (request, response) => {
      const { id } = request.params

      if (!isValidUuid(id)) {
        return response.status(400).json({
          error:
            'Identificador de orçamento inválido.',
        })
      }

      try {
        const result = await database.query(
          `
            DELETE FROM budgets
            WHERE id = $1
              AND user_id = $2
            RETURNING id
          `,
          [
            id,
            request.user.id,
          ],
        )

        if (result.rowCount === 0) {
          return response.status(404).json({
            error: 'Orçamento não encontrado.',
          })
        }

        return response.status(204).send()
      } catch (error) {
        console.error(
          'Failed to delete budget:',
          error,
        )

        return response.status(500).json({
          error:
            'Não foi possível excluir o orçamento.',
        })
      }
    },
  )

    app.post('/budgets/:id/split', async (request, response) => {
    const { id } = request.params
    const { splitPeriod } = request.body ?? {}

    if (!isValidUuid(id)) {
      return response.status(400).json({
        error: 'Identificador de orçamento inválido.',
      })
    }

    if (!isValidBudgetPeriod(splitPeriod)) {
      return response.status(400).json({
        error: 'Informe um mês de alteração válido.',
      })
    }

    let client
    let transactionStarted = false

    try {
      client = await database.connect()
      await client.query('BEGIN')
      transactionStarted = true

      const existingResult = await client.query(
        `
          SELECT
            to_char(start_period, 'YYYY-MM') AS start_period,
            CASE
              WHEN end_period IS NULL THEN NULL
              ELSE to_char(end_period, 'YYYY-MM')
            END AS end_period
          FROM budgets
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE
        `,
        [id, request.user.id],
      )

      if (existingResult.rowCount === 0) {
        await client.query('ROLLBACK')
        transactionStarted = false

        return response.status(404).json({
          error: 'Orçamento não encontrado.',
        })
      }

      const existingBudget = existingResult.rows[0]

      if (splitPeriod <= existingBudget.start_period) {
        await client.query('ROLLBACK')
        transactionStarted = false

        return response.status(400).json({
          error:
            'O mês da alteração deve ser posterior ao início do orçamento.',
        })
      }

      if (
        existingBudget.end_period !== null &&
        splitPeriod > existingBudget.end_period
      ) {
        await client.query('ROLLBACK')
        transactionStarted = false

        return response.status(409).json({
          error:
            'O mês da alteração está fora da vigência atual do orçamento.',
        })
      }

      // Fim omitido herda o fim da regra original (contrato da V1).
      const requestedEndPeriod =
        request.body?.endPeriod === undefined
          ? existingBudget.end_period
          : request.body.endPeriod

      const validation = validateBudgetInput({
        startPeriod: splitPeriod,
        endPeriod: requestedEndPeriod,
        category: request.body?.category,
        plannedAmountInCents:
          request.body?.plannedAmountInCents,
      })

      if (validation.error) {
        await client.query('ROLLBACK')
        transactionStarted = false

        return response.status(400).json({
          error: validation.error,
        })
      }

      const {
        endPeriod,
        category,
        categoryKey,
        plannedAmountInCents,
      } = validation.budget

      const splitDate = `${splitPeriod}-01`
      const endDate = endPeriod === null
        ? null
        : `${endPeriod}-01`
      const newId = randomUUID()

      // Encerra o segmento antigo no mês imediatamente anterior.
      const updatedResult = await client.query(
        `
          UPDATE budgets
          SET end_period = (
            $1::date - INTERVAL '1 month'
          )::date
          WHERE id = $2
            AND user_id = $3
          RETURNING
            id,
            to_char(start_period, 'YYYY-MM') AS start_period,
            to_char(end_period, 'YYYY-MM') AS end_period,
            category,
            planned_amount_in_cents
        `,
        [splitDate, id, request.user.id],
      )

      const insertedResult = await client.query(
        `
          INSERT INTO budgets (
            id,
            user_id,
            start_period,
            end_period,
            category,
            category_key,
            planned_amount_in_cents
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING
            id,
            to_char(start_period, 'YYYY-MM') AS start_period,
            CASE
              WHEN end_period IS NULL THEN NULL
              ELSE to_char(end_period, 'YYYY-MM')
            END AS end_period,
            category,
            planned_amount_in_cents
        `,
        [
          newId,
          request.user.id,
          splitDate,
          endDate,
          category,
          categoryKey,
          plannedAmountInCents,
        ],
      )

      await client.query('COMMIT')
      transactionStarted = false

      const previous = updatedResult.rows[0]
      const created = insertedResult.rows[0]

      return response.status(201).json({
        previousBudget: {
          id: previous.id,
          startPeriod: previous.start_period,
          endPeriod: previous.end_period,
          category: previous.category,
          plannedAmountInCents: Number(
            previous.planned_amount_in_cents,
          ),
        },
        createdBudget: {
          id: created.id,
          startPeriod: created.start_period,
          endPeriod: created.end_period,
          category: created.category,
          plannedAmountInCents: Number(
            created.planned_amount_in_cents,
          ),
        },
      })
    } catch (error) {
      if (client && transactionStarted) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          console.error(
            'Failed to rollback budget split:',
            rollbackError,
          )
        }
      }

      if (
        error?.code === '23P01' &&
        error?.constraint === 'budgets_no_overlapping_periods'
      ) {
        return response.status(409).json({
          error:
            'Já existe um orçamento para essa categoria em parte do período informado.',
        })
      }

      console.error('Failed to split budget:', error)

      return response.status(500).json({
        error: 'Não foi possível dividir o orçamento.',
      })
    } finally {
      if (client) {
        client.release()
      }
    }
  })
  app.post(
    '/transactions/import/preview',
    receiveTransactionImportFile,
    async (request, response) => {
      const fileResult =
      parseTransactionImportFile(
        request.file,
      )

      if (fileResult.error) {
        return response
        .status(fileResult.status)
        .json({
          error: fileResult.error,
        })
      }

      const { parsedImport } = fileResult

      try {
        const result = await database.query(
          `
            SELECT
              to_char(
                transaction_date,
                'YYYY-MM-DD'
              ) AS date,
              transaction_type AS type,
              description,
              category,
              amount_in_cents
            FROM transactions
            WHERE user_id = $1
          `,
          [request.user.id],
        )

        const existingTransactions =
        result.rows.map(
          (transaction) => ({
            date: transaction.date,
            type: transaction.type,
            description:
            transaction.description,
            category: transaction.category,
            amountInCents: Number(
              transaction.amount_in_cents,
            ),
          }),
        )

        const preview =
        buildTransactionImportPreview(
          parsedImport,
          existingTransactions,
        )

        return response.json(preview)
      } catch (error) {
        console.error(
          'Failed to preview transaction import:',
          error,
        )

        return response.status(500).json({
          error:
          'Não foi possível preparar a importação.',
        })
      }
    },
  )

  app.post(
    '/transactions/import',
    receiveTransactionImportFile,
    async (request, response) => {
      const fileResult =
      parseTransactionImportFile(
        request.file,
      )

      if (fileResult.error) {
        return response
        .status(fileResult.status)
        .json({
          error: fileResult.error,
        })
      }

      const { parsedImport } = fileResult

      const duplicateOption =
      parseIncludeDuplicates(
        request.body.includeDuplicates,
      )

      if (duplicateOption.error) {
        return response.status(400).json({
          error: duplicateOption.error,
        })
      }

      if (
        parsedImport.rejectedRows.length > 0
      ) {
        return response.status(400).json({
          error:
          'O arquivo CSV possui linhas inválidas.',
          rejectedRows:
          parsedImport.rejectedRows,
        })
      }

      if (
        parsedImport.validRows.length === 0
      ) {
        return response.status(400).json({
          error:
          'O arquivo CSV não possui transações válidas.',
        })
      }

      const { includeDuplicates } =
      duplicateOption

      let client
      let transactionStarted = false

      try {
        client = await database.connect()

        await client.query('BEGIN')
        transactionStarted = true

        const existingResult =
        await client.query(
          `
            SELECT
              to_char(
                transaction_date,
                'YYYY-MM-DD'
              ) AS date,
              transaction_type AS type,
              description,
              category,
              amount_in_cents
            FROM transactions
            WHERE user_id = $1
          `,
          [request.user.id],
        )

        const existingTransactions =
        existingResult.rows.map(
          (transaction) => ({
            date: transaction.date,
            type: transaction.type,
            description:
            transaction.description,
            category: transaction.category,
            amountInCents: Number(
              transaction.amount_in_cents,
            ),
          }),
        )

        const {
          newTransactions,
          matchingTransactions,
        } =
        splitTransactionsByDuplicateMatch(
          parsedImport.validRows,
          existingTransactions,
        )

        const transactionsToInsert =
        includeDuplicates
        ? parsedImport.validRows
        : newTransactions

        const skippedDuplicateCount =
        includeDuplicates
        ? 0
        : matchingTransactions.length

        let insertedTransactions = []

        if (
          transactionsToInsert.length > 0
        ) {
          const values = []

          const placeholders =
          transactionsToInsert.map(
            (transaction, index) => {
              const parameterOffset =
              index * 7

              values.push(
                randomUUID(),
                request.user.id,
                transaction.date,
                transaction.type,
                transaction.description,
                transaction.category,
                transaction.amountInCents,
              )

              return `(
                $${parameterOffset + 1},
                $${parameterOffset + 2},
                $${parameterOffset + 3},
                $${parameterOffset + 4},
                $${parameterOffset + 5},
                $${parameterOffset + 6},
                $${parameterOffset + 7}
              )`
            },
          )

          const insertResult =
          await client.query(
            `
              INSERT INTO transactions (
                id,
                user_id,
                transaction_date,
                transaction_type,
                description,
                category,
                amount_in_cents
              )
              VALUES
                ${placeholders.join(',')}
              RETURNING
                id,
                to_char(
                  transaction_date,
                  'YYYY-MM-DD'
                ) AS date,
                description,
                category,
                transaction_type AS type,
                amount_in_cents
            `,
            values,
          )

          insertedTransactions =
          insertResult.rows.map(
            (transaction) => ({
              id: transaction.id,
              date: transaction.date,
              description:
              transaction.description,
              category:
              transaction.category,
              type: transaction.type,
              amountInCents: Number(
                transaction.amount_in_cents,
              ),
            }),
          )
        }

        await client.query('COMMIT')
        transactionStarted = false

        return response.json({
          insertedCount:
          insertedTransactions.length,
          skippedDuplicateCount,
          transactions:
          insertedTransactions,
        })
      } catch (error) {
        if (
          client &&
          transactionStarted
        ) {
          try {
            await client.query('ROLLBACK')
          } catch (rollbackError) {
            console.error(
              'Failed to rollback transaction import:',
              rollbackError,
            )
          }
        }

        console.error(
          'Failed to import transactions:',
          error,
        )

        return response.status(500).json({
          error:
          'Não foi possível concluir a importação.',
        })
      } finally {
        if (client) {
          client.release()
        }
      }
    },
  )
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
        WHERE user_id = $1
        ORDER BY transaction_date DESC, id DESC
      `,
        [request.user.id],
      )

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
            user_id,
            transaction_date,
            transaction_type,
            description,
            category,
            amount_in_cents
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
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
          request.user.id,
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
           AND user_id = $7
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
          request.user.id,
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
           AND user_id = $2
          RETURNING id
        `,
        [
          id,
          request.user.id,
        ],

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