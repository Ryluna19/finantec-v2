function normalizeCategoryKey(category) {
  return String(category ?? '')
    .trim()
    .replace(/\s+/gu, ' ')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
}

export function calculateMonthlyBudgetTracking({
  transactions,
  budgets,
  period,
}) {
  const expensesByCategory = new Map()

  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      transaction.date.slice(0, 7) !== period
    ) {
      continue
    }

    const categoryKey = normalizeCategoryKey(
      transaction.category,
    )

    if (!categoryKey || categoryKey === 'reserva') {
      continue
    }

    expensesByCategory.set(
      categoryKey,
      (expensesByCategory.get(categoryKey) ?? 0) +
        transaction.amountInCents,
    )
  }

  const items = budgets
    .filter(
      (budget) =>
        budget.startPeriod <= period &&
        (
          budget.endPeriod === null ||
          budget.endPeriod >= period
        ),
    )
    .map((budget) => {
      if (
        !Number.isSafeInteger(
          budget.plannedAmountInCents,
        ) ||
        budget.plannedAmountInCents <= 0
      ) {
        throw new RangeError(
          'O valor planejado deve ser um inteiro positivo em centavos.',
        )
      }

      const spentInCents =
        expensesByCategory.get(
          normalizeCategoryKey(budget.category),
        ) ?? 0

      const remainingInCents =
        budget.plannedAmountInCents - spentInCents

      const usagePercentage =
        (spentInCents / budget.plannedAmountInCents) *
        100

      const status =
        usagePercentage > 100
          ? 'over_limit'
          : usagePercentage >= 80
            ? 'near_limit'
            : 'within_limit'

      return {
        ...budget,
        spentInCents,
        remainingInCents,
        usagePercentage,
        status,
      }
    })

  const summary = items.reduce(
    (totals, item) => ({
      totalPlannedInCents:
        totals.totalPlannedInCents +
        item.plannedAmountInCents,
      totalSpentInCents:
        totals.totalSpentInCents + item.spentInCents,
      totalRemainingInCents:
        totals.totalRemainingInCents +
        item.remainingInCents,
      plannedCategories: totals.plannedCategories + 1,
      categoriesOverLimit:
        totals.categoriesOverLimit +
        (item.status === 'over_limit' ? 1 : 0),
    }),
    {
      totalPlannedInCents: 0,
      totalSpentInCents: 0,
      totalRemainingInCents: 0,
      plannedCategories: 0,
      categoriesOverLimit: 0,
    },
  )

  return { items, summary }
}