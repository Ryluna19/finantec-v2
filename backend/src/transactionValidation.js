export function isValidDate(date) {
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false
  }

  const [year, month, day] = date
    .split('-')
    .map(Number)

  const parsedDate = new Date(
    Date.UTC(year, month - 1, day),
  )

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  )
}

export function inspectTransactionInput({
  date,
  description,
  category,
  type,
  amountInCents,
} = {}) {
  const normalizedDescription =
    typeof description === 'string'
      ? description.trim()
      : ''

  const normalizedCategory =
    typeof category === 'string'
      ? category.trim()
      : ''

  const issues = []

  if (!isValidDate(date)) {
    issues.push({
      field: 'date',
      message: 'Informe uma data válida.',
      importReason: 'data invalida ou vazia',
    })
  }

  if (!normalizedDescription) {
    issues.push({
      field: 'description',
      message: 'Informe uma descrição válida.',
      importReason: 'descricao vazia',
    })
  }

  if (!normalizedCategory) {
    issues.push({
      field: 'category',
      message: 'Informe uma categoria válida.',
      importReason: 'categoria vazia',
    })
  }

  if (!['income', 'expense'].includes(type)) {
    issues.push({
      field: 'type',
      message: 'Informe um tipo válido.',
      importReason:
        typeof type !== 'string' ||
        type.length === 0
          ? 'tipo vazio'
          : 'tipo invalido',
    })
  }

  if (!Number.isSafeInteger(amountInCents)) {
    issues.push({
      field: 'amountInCents',
      message:
        'Informe um valor positivo dentro do limite permitido.',
      importReason: 'valor invalido ou vazio',
    })
  } else if (amountInCents <= 0) {
    issues.push({
      field: 'amountInCents',
      message:
        'Informe um valor positivo dentro do limite permitido.',
      importReason: 'valor menor ou igual a zero',
    })
  }

  return {
    transaction: {
      date,
      description: normalizedDescription,
      category: normalizedCategory,
      type,
      amountInCents,
    },
    issues,
  }
}

export function validateTransactionInput(input) {
  const result = inspectTransactionInput(input)

  if (result.issues.length > 0) {
    return {
      error: result.issues[0].message,
    }
  }

  return {
    transaction: result.transaction,
  }
}