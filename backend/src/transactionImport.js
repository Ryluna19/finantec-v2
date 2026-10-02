import { parse } from 'csv-parse/sync'
import {
  inspectTransactionInput,
} from './transactionValidation.js'

const REQUIRED_HEADERS = [
  'data',
  'tipo',
  'descricao',
  'categoria',
  'valor',
]

function normalizeHeader(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replaceAll(' ', '_')
}

function parseAmountInCents(value) {
  const normalized = String(value ?? '').trim()

  if (!/^\+?\d+(?:\.\d+)?$/.test(normalized)) {
    return null
  }

  const unsigned = normalized.startsWith('+')
    ? normalized.slice(1)
    : normalized

  const [wholePart, decimalPart = ''] =
    unsigned.split('.')

  const whole = Number(wholePart)

  if (!Number.isSafeInteger(whole)) {
    return null
  }

  const paddedDecimals =
    `${decimalPart}000`

  let cents =
    whole * 100 +
    Number(paddedDecimals.slice(0, 2))

  /*
   * O PostgreSQL armazena centavos inteiros.
   * Quando o CSV possui fração menor que um centavo,
   * arredondamos para o centavo mais próximo.
   */
  if (Number(paddedDecimals[2]) >= 5) {
    cents += 1
  }

  if (!Number.isSafeInteger(cents)) {
    return null
  }

  return cents
}

function mapCsvType(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (normalized === 'receita') {
    return 'income'
  }

  if (normalized === 'despesa') {
    return 'expense'
  }

  return normalized
}

function createTransactionKey(transaction) {
  return JSON.stringify([
    transaction.date,
    transaction.type,
    transaction.description.trim(),
    transaction.category.trim(),
    transaction.amountInCents,
  ])
}

export function splitTransactionsByDuplicateMatch(
  importedTransactions,
  existingTransactions,
) {
  const existingCounts = new Map()

  for (const transaction of existingTransactions) {
    const key = createTransactionKey(transaction)

    existingCounts.set(
      key,
      (existingCounts.get(key) ?? 0) + 1,
    )
  }

  const newTransactions = []
  const matchingTransactions = []

  for (const transaction of importedTransactions) {
    const key = createTransactionKey(transaction)
    const existingCount =
      existingCounts.get(key) ?? 0

    if (existingCount > 0) {
      matchingTransactions.push(transaction)

      existingCounts.set(
        key,
        existingCount - 1,
      )

      continue
    }

    newTransactions.push(transaction)
  }

  return {
    newTransactions,
    matchingTransactions,
  }
}

export function parseCanonicalTransactionCsv(
  csvContent,
) {
  let records

  try {
    records = parse(csvContent, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    })
  } catch {
    throw new Error(
      'Não foi possível interpretar o arquivo CSV.',
    )
  }

  if (records.length === 0) {
    throw new Error('O arquivo CSV está vazio.')
  }

  const headers = records[0].map(normalizeHeader)

  const duplicateHeaders = headers.filter(
    (header, index) =>
      headers.indexOf(header) !== index,
  )

  if (duplicateHeaders.length > 0) {
    throw new Error(
      'O arquivo CSV possui cabeçalhos duplicados.',
    )
  }

  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  )

  if (missingHeaders.length > 0) {
    throw new Error(
      `O arquivo CSV não possui as colunas obrigatórias: ${missingHeaders.join(', ')}`,
    )
  }

  const headerIndexes = Object.fromEntries(
    REQUIRED_HEADERS.map((header) => [
      header,
      headers.indexOf(header),
    ]),
  )

  const validRows = []
  const rejectedRows = []

  records.slice(1).forEach((record, index) => {
    const rowNumber = index + 2

    if (record.length !== headers.length) {
      rejectedRows.push({
        rowNumber,
        reasons: [
          'quantidade de colunas invalida',
        ],
      })

      return
    }

    const rawType =
      record[headerIndexes.tipo]

    const rawAmount =
      record[headerIndexes.valor]

    const amountInCents =
      parseAmountInCents(rawAmount)

    const transaction = {
      date: String(
        record[headerIndexes.data] ?? '',
      ).trim(),
      type: mapCsvType(rawType),
      description: String(
        record[headerIndexes.descricao] ?? '',
      ).trim(),
      category: String(
        record[headerIndexes.categoria] ?? '',
      ).trim(),
      amountInCents,
    }

    const { transaction: normalizedTransaction, issues } =
      inspectTransactionInput(transaction)

    if (issues.length > 0) {
      rejectedRows.push({
        rowNumber,
        date: transaction.date,
        type: String(rawType ?? '').trim(),
        description:
          transaction.description,
        category: transaction.category,
        amount: String(rawAmount ?? '').trim(),
        reasons: issues.map(
          (issue) => issue.importReason,
        ),
      })

      return
    }

    validRows.push({
      rowNumber,
      ...normalizedTransaction,
    })
  })

  return {
    totalRows: records.length - 1,
    validRows,
    rejectedRows,
  }
}