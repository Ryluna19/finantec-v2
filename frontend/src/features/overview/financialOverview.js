import {
  normalizeCategoryKey,
  formatCategoryLabel,
} from '../../shared/category'

function isReserveCategory(category) {
  return normalizeCategoryKey(category) === 'reserva'
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

        const key = normalizeCategoryKey(transaction.category)

          if (expensesByCategory.has(key)) {
            expensesByCategory.get(key).amountInCents += transaction.amountInCents


          } else {
            expensesByCategory.set(key, {
              category: formatCategoryLabel(transaction.category),
              amountInCents: transaction.amountInCents,
            })
          }
  }

  const expenseCategories = [
  ...expensesByCategory.values(),
  ].sort(
    (first, second) =>
      second.amountInCents - first.amountInCents,
  )

  const largestExpenseCategory =
  expenseCategories[0]?.category ?? null

  const largestExpenseCategoryInCents =
  expenseCategories[0]?.amountInCents ?? 0

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