export function isValidBudgetPeriod(period) {
  if (
    typeof period !== 'string' ||
    !/^\d{4}-\d{2}$/.test(period)
  ) {
    return false
  }

  const [year, month] = period
    .split('-')
    .map(Number)

  return (
    year >= 1 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12
  )
}

function normalizeBudgetCategory(category) {
  if (typeof category !== 'string') {
    return ''
  }

  return category
    .trim()
    .replace(/\s+/gu, ' ')
}

export function normalizeBudgetCategoryKey(category) {
  return normalizeBudgetCategory(category)
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

export function validateBudgetInput({
  startPeriod,
  endPeriod,
  category,
  plannedAmountInCents,
} = {}) {
  if (!isValidBudgetPeriod(startPeriod)) {
    return {
      error: 'Informe um mês inicial válido.',
    }
  }

  const normalizedEndPeriod =
    endPeriod === undefined
      ? null
      : endPeriod

  if (
    normalizedEndPeriod !== null &&
    !isValidBudgetPeriod(
      normalizedEndPeriod,
    )
  ) {
    return {
      error: 'Informe um mês final válido.',
    }
  }

  if (
    normalizedEndPeriod !== null &&
    normalizedEndPeriod < startPeriod
  ) {
    return {
      error:
        'O mês final não pode ser anterior ao mês inicial.',
    }
  }

  const normalizedCategory =
    normalizeBudgetCategory(category)

  if (!normalizedCategory) {
    return {
      error: 'Informe uma categoria válida.',
    }
  }

  if (
    Array.from(normalizedCategory).length > 100
  ) {
    return {
      error:
        'A categoria deve ter no máximo 100 caracteres.',
    }
  }

  const categoryKey =
    normalizeBudgetCategoryKey(
      normalizedCategory,
    )

  if (!categoryKey) {
    return {
      error: 'Informe uma categoria válida.',
    }
  }

  if (categoryKey === 'reserva') {
    return {
      error:
        'A categoria Reserva não pode ter orçamento.',
    }
  }

  if (
    !Number.isSafeInteger(
      plannedAmountInCents,
    ) ||
    plannedAmountInCents <= 0
  ) {
    return {
      error:
        'Informe um valor positivo dentro do limite permitido.',
    }
  }

  return {
    budget: {
      startPeriod,
      endPeriod: normalizedEndPeriod,
      category: normalizedCategory,
      categoryKey,
      plannedAmountInCents,
    },
  }
}