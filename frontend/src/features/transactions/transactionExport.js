const CSV_BOM = '\uFEFF'
const CSV_LINE_BREAK = '\r\n'

const CSV_HEADERS = [
  'DATA',
  'TIPO',
  'DESCRIÇÃO',
  'CATEGORIA',
  'VALOR',
]

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@]/

function formatTransactionType(type) {
  if (type === 'income') {
    return 'receita'
  }

  if (type === 'expense') {
    return 'despesa'
  }

  throw new Error(
    `Tipo de transação inválido para exportação: ${type}`,
  )
}

function formatAmountInCents(amountInCents) {
  return (amountInCents / 100).toFixed(2)
}

function escapeCsvCell(
  value,
  { protectSpreadsheetFormula = false } = {},
) {
  let text = String(value)

  if (
    protectSpreadsheetFormula &&
    SPREADSHEET_FORMULA_PREFIX.test(text)
  ) {
    text = `\t${text}`
  }

  if (/[",\r\n\t]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

export function serializeTransactionsToCsv(
  transactions,
) {
  const rows = transactions.map((transaction) => [
    escapeCsvCell(transaction.date),
    escapeCsvCell(
      formatTransactionType(transaction.type),
    ),
    escapeCsvCell(transaction.description, {
      protectSpreadsheetFormula: true,
    }),
    escapeCsvCell(transaction.category, {
      protectSpreadsheetFormula: true,
    }),
    escapeCsvCell(
      formatAmountInCents(
        transaction.amountInCents,
      ),
    ),
  ])

  return (
    CSV_BOM +
    [CSV_HEADERS, ...rows]
      .map((row) => row.join(','))
      .join(CSV_LINE_BREAK) +
    CSV_LINE_BREAK
  )
}

export function downloadTransactionsCsv(
  transactions,
) {
  const csv = serializeTransactionsToCsv(
    transactions,
  )

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8',
  })

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download =
    'finantec_transacoes_periodo.csv'

  document.body.appendChild(link)
  link.click()
  link.remove()

  URL.revokeObjectURL(objectUrl)
}