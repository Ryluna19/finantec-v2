import { useState } from 'react'
import TransactionList from './components/TransactionList'
import TransactionForm from './components/TransactionForm'
import './App.css'

const sampleTransactions = [
    {
      id: 'sample-1',
      date: '2026-07-10',
      description: 'Bolsa de estágio',
      category: 'Trabalho',
      type: 'income',
      amountInCents: 150000,
    },
    {
      id: 'sample-2',
      date: '2026-07-15',
      description: 'Compra no mercado',
      category: 'Alimentação',
      type: 'expense',
      amountInCents: 8590,
    },
  ]

function App() {
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [transactions, setTransactions] = useState(sampleTransactions)
  

  function handleAddTransaction(transactionData) {
    const newTransaction = {
      ...transactionData,
      id: crypto.randomUUID(),
    }

    setTransactions((previous) => [newTransaction, ...previous])
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
            Ambiente de exemplo. Os dados desta tela são perdidos ao
            recarregar a página.
          </p>

          <TransactionForm onAddTransaction={handleAddTransaction} />
        </section>

        <section className="panel" aria-labelledby="transactions-title">
          <h2 id="transactions-title">Movimentações</h2>

          <TransactionList transactions={transactions} />
        </section>
      </main>
    </div>
  )
}



export default App