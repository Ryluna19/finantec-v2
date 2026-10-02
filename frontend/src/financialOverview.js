function isReserveCategory(category) {
  return (
    category.trim().toLocaleLowerCase('pt-BR') ===
    'reserva'
  )
}

export function calculateFinancialOverview(
  transactions,
) {
  let incomeInCents = 0
  let totalExpenseInCents = 0
  let reserveInCents = 0

  const expensesByCategory = new Map()

  for (const transaction of transactions) {
    if (transaction.type === 'income') {
      incomeInCents += transaction.amountInCents
      continue
    }

    if (transaction.type !== 'expense') {
      continue
    }

    totalExpenseInCents += transaction.amountInCents

    if (isReserveCategory(transaction.category)) {
      reserveInCents += transaction.amountInCents
      continue
    }

    expensesByCategory.set(
      transaction.category,
      (expensesByCategory.get(transaction.category) ?? 0) +
        transaction.amountInCents,
    )
  }

  let largestExpenseCategory = null
  let largestExpenseCategoryInCents = 0

  for (const [
    category,
    amountInCents,
  ] of expensesByCategory) {
    if (
      amountInCents >
      largestExpenseCategoryInCents
    ) {
      largestExpenseCategory = category
      largestExpenseCategoryInCents = amountInCents
    }
  }

  const consumptionInCents =
    totalExpenseInCents - reserveInCents

  return {
    incomeInCents,
    totalExpenseInCents,
    consumptionInCents,
    reserveInCents,
    balanceInCents:
      incomeInCents - totalExpenseInCents,
    largestExpenseCategory,
    largestExpenseCategoryInCents,
  }
}