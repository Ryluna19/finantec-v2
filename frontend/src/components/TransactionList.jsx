const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatDate(date) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function TransactionList({ transactions, onDeleteTransaction }) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <p>Nenhuma transação para exibir.</p>
      </div>
    )
  }

  async function handleDelete(transaction) {
    const confirmed = window.confirm(
      `Excluir permanentemente a transação "${transaction.description}"?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await onDeleteTransaction(transaction.id)
    } catch (error) {
      window.alert(error.message)
    }
  }

  return (
    <div
      className="transaction-table-container"
      role="region"
      aria-label="Lista de transações"
      tabIndex={0}
    >
      <table className="transaction-table">
        <caption>Movimentações financeiras</caption>

        <thead>
          <th scope="col">Ações</th>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Descrição</th>
            <th scope="col">Categoria</th>
            <th scope="col">Tipo</th>
            <th scope="col" className="transaction-amount">Valor</th>
          </tr>
        </thead>

        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{formatDate(transaction.date)}</td>
              <td>{transaction.description}</td>
              <td>{transaction.category}</td>
              <td>
                {transaction.type === 'income' ? 'Receita' : 'Despesa'}
              </td>
              <td
                className={`transaction-amount transaction-${transaction.type}`}
              >
                {currencyFormatter.format(transaction.amountInCents / 100)}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => handleDelete(transaction)}
                  aria-label={`Excluir ${transaction.description}`}
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TransactionList