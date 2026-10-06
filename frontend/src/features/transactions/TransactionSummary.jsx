const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function TransactionSummary({
  transactionCount,
  incomeInCents,
  expenseInCents,
}) {
  return (
    <div className="transaction-summary" aria-label="Resumo das transações filtradas">
      <div className="summary-card">
        <span className="summary-label">Transações</span>
        <strong>{transactionCount}</strong>
      </div>

      <div className="summary-card">
        <span className="summary-label">Receitas</span>
        <strong className="transaction-income">
          {currencyFormatter.format(incomeInCents / 100)}
        </strong>
      </div>

      <div className="summary-card">
        <span className="summary-label">Despesas</span>
        <strong className="transaction-expense">
          {currencyFormatter.format(expenseInCents / 100)}
        </strong>
      </div>
    </div>
  )
}

export default TransactionSummary