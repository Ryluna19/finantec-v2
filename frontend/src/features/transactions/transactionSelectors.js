export function filterTransactionsByPeriod(
  transactions,
  year,
  month,
) {
  return transactions.filter((transaction) => {
    const transactionYear = Number(
      transaction.date.slice(0, 4),
    )

    const transactionMonth = Number(
      transaction.date.slice(5, 7),
    )

    if (transactionYear !== year) {
      return false
    }

    if (
      month !== 'all' &&
      transactionMonth !== month
    ) {
      return false
    }

    return true
  })
}