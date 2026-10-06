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
    let expenseTransactionCount = 0

    const expensesByCategory = new Map()

    const monthlyEvolution = Array.from(
        { length: 12 },
        (_, index) => ({
            month: index + 1,
            incomeInCents: 0,
            expenseInCents: 0,
     }),
    )

    for (const transaction of transactions) {
        const monthIndex =
        Number(transaction.date?.slice(5, 7)) - 1

        const monthlyEntry =
        monthlyEvolution[monthIndex]
        if (transaction.type === 'income') {
        incomeInCents += transaction.amountInCents

        if (monthlyEntry) {
            monthlyEntry.incomeInCents +=
            transaction.amountInCents
        }

        continue
        }

        if (transaction.type !== 'expense') {
        continue
        }

        expenseTransactionCount += 1
        totalExpenseInCents += transaction.amountInCents

        if (monthlyEntry) {
        monthlyEntry.expenseInCents +=
            transaction.amountInCents
        }

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

  const expenseCategories = [
  ...expensesByCategory.entries(),
]
  .map(([category, amountInCents]) => ({
    category,
    amountInCents,
  }))
  .sort(
    (first, second) =>
      second.amountInCents -
      first.amountInCents,
  )

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

    const averageExpenseInCents =
    expenseTransactionCount > 0
        ? totalExpenseInCents /
        expenseTransactionCount
        : 0

    const consumptionPercentage =
    incomeInCents > 0
        ? (consumptionInCents / incomeInCents) *
        100
        : 0

    const reservePercentage =
    incomeInCents > 0
        ? (reserveInCents / incomeInCents) * 100
        : 0

  return {
  incomeInCents,
  totalExpenseInCents,
  consumptionInCents,
  reserveInCents,
  balanceInCents:
    incomeInCents - totalExpenseInCents,
  transactionCount: transactions.length,
  expenseTransactionCount,
  averageExpenseInCents,
  consumptionPercentage,
  reservePercentage,
  expenseCategories,
  monthlyEvolution,
  largestExpenseCategory,
  largestExpenseCategoryInCents,
}
}