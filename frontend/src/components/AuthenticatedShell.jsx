import { useState } from 'react'
import TransactionsPage from './TransactionsPage'
import useTransactions from '../hooks/useTransactions'

function AuthenticatedShell({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
  onLogout,
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false)

  const {
    transactions,
    isLoadingTransactions,
    transactionsLoadError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions({
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireSession,
  })

  return (
    <div
      className={`app-layout${
        isSidebarCollapsed
          ? ' sidebar-collapsed'
          : ''
      }`}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <a
            className="brand"
            href="#transactions"
            aria-label="FinanTec"
          >
            <span className="brand-name">
              FinanTec
            </span>

            <span
              className="brand-short"
              aria-hidden="true"
            >
              FT
            </span>
          </a>

          <button
            className="sidebar-toggle"
            type="button"
            onClick={() =>
              setIsSidebarCollapsed(
                (previous) => !previous,
              )
            }
            aria-label={
              isSidebarCollapsed
                ? 'Expandir menu'
                : 'Recolher menu'
            }
            aria-expanded={
              !isSidebarCollapsed
            }
            aria-controls="sidebar-navigation"
          >
            <span aria-hidden="true">
              ☰
            </span>
          </button>
        </div>

        <nav
          id="sidebar-navigation"
          aria-label="Navegação principal"
        >
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

            <span className="nav-label">
              Transações
            </span>
          </a>
        </nav>
      </aside>

      <TransactionsPage
        transactions={transactions}
        isLoadingTransactions={
          isLoadingTransactions
        }
        transactionsLoadError={
          transactionsLoadError
        }
        addTransaction={addTransaction}
        updateTransaction={
          updateTransaction
        }
        deleteTransaction={
          deleteTransaction
        }
        onLogout={onLogout}
      />
    </div>
  )
}

export default AuthenticatedShell