import { useEffect, useState } from 'react'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import './App.css'

function App() {

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    async function loadTransactions() {
      try {
        const response = await fetch('http://localhost:3000/transactions')

        if (!response.ok) {
          throw new Error('Não foi possível carregar as transações.')
        }

        const data = await response.json()
        setTransactions(data)
      } catch (error) {
        console.error(error)
      }
    }

    loadTransactions()
  }, [])

  async function handleAddTransaction(transactionData) {
  const response = await fetch('http://localhost:3000/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(transactionData),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível cadastrar a transação.')
  }

  setTransactions((previous) => [data, ...previous])
}

async function handleDeleteTransaction(id) {
  const response = await fetch(`http://localhost:3000/transactions/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    let message = 'Não foi possível excluir a transação.'

    try {
      const data = await response.json()
      message = data.error || message
    } catch {
      // Mantém a mensagem padrão se a resposta não possuir JSON válido.
    }

    throw new Error(message)
  }

  setTransactions((previous) =>
    previous.filter((transaction) => transaction.id !== id),
  )
}

  return (
    <div className={`app-layout${isSidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <a className="brand" href="#transactions" aria-label="FinanTec">
            <span className="brand-name">FinanTec</span>
            <span className="brand-short" aria-hidden="true">FT</span>
          </a>

          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((previous) => !previous)}
            aria-label={
              isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'
            }
            aria-expanded={!isSidebarCollapsed}
            aria-controls="sidebar-navigation"
          >
            <span aria-hidden="true">☰</span>
          </button>
        </div>

        <nav id="sidebar-navigation" aria-label="Navegação principal">
          <a
            className="nav-link"
            href="#transactions"
            aria-current="page"
            aria-label="Transações"
            title="Transações"
          >
            <svg
              className="nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
            </svg>

            <span className="nav-label">Transações</span>
          </a>
        </nav>
      </aside>

      <main className="main-content" id="transactions">
        <header className="page-header">
          <h1>Transações</h1>
          <p>Organize suas receitas, despesas e reservas.</p>
        </header>

        <section className="panel" aria-labelledby="new-transaction-title">
          <h2 id="new-transaction-title">Nova transação</h2>
          <p className="prototype-notice">
             Ambiente em desenvolvimento com persistência local.
          </p>

          <TransactionForm onAddTransaction={handleAddTransaction} />
        </section>

        <section className="panel" aria-labelledby="transactions-title">
          <h2 id="transactions-title">Movimentações</h2>

          <TransactionList
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
          />
        </section>
      </main>
    </div>
  )
}



export default App