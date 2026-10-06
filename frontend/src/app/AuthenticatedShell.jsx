import { useState } from 'react'
import OverviewPage from '../features/overview/OverviewPage'
import TransactionsPage from '../features/transactions/TransactionsPage'
import useTransactions from '../features/transactions/useTransactions'
import finantecMark from '../assets/branding/finantec-header-mark.svg'

function AuthenticatedShell({
  captureAuthGeneration,
  isCurrentAuthGeneration,
  expireSession,
  onLogout,
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false)

  const [activeView, setActiveView] =
   useState('overview')

  const {
    transactions,
    isLoadingTransactions,
    transactionsLoadError,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    previewTransactionImport,
    importTransactions,
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
          <span
            className="brand"
            aria-label="FinanTec"
          >
            <span className="brand-name">
              FinanTec
            </span>

            <span
              className="brand-short"
              aria-hidden="true"
            >
              <img
                src={finantecMark}
                alt=""
                width="32"
                height="32"
              />
            </span>
          </span>

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
            aria-expanded={!isSidebarCollapsed}
            aria-controls="sidebar-navigation"
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
              <path
                d={
                  isSidebarCollapsed
                    ? 'M6 7l5 5-5 5'
                    : 'M18 7l-5 5 5 5'
                }
              />

              <path
                d={
                  isSidebarCollapsed
                    ? 'M13 7l5 5-5 5'
                    : 'M11 7l-5 5 5 5'
                }
              />
            </svg>
          </button>
        </div>

        <nav
          id="sidebar-navigation"
          aria-label="Navegação principal"
        >
          <button
            className="nav-link nav-button"
            type="button"
            onClick={() =>
              setActiveView('overview')
            }
            aria-current={
              activeView === 'overview'
                ? 'page'
                : undefined
            }
            title="Visão geral"
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
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
              />
            </svg>

            <span className="nav-label">
              Visão geral
            </span>
          </button>

          <button
            className="nav-link nav-button"
            type="button"
            onClick={() =>
              setActiveView('transactions')
            }
            aria-current={
              activeView === 'transactions'
                ? 'page'
                : undefined
            }
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
          </button>
        </nav>

        <button
          className="nav-link nav-button sidebar-logout"
          type="button"
          onClick={onLogout}
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
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          </svg>

          <span className="nav-label">
            Sair
          </span>
        </button>
      </aside>

      {activeView === 'overview' ? (
        <OverviewPage
          transactions={transactions}
          isLoadingTransactions={
            isLoadingTransactions
          }
          transactionsLoadError={
            transactionsLoadError
          }
        />
      ) : (
        <TransactionsPage
          transactions={transactions}
          isLoadingTransactions={
            isLoadingTransactions
          }
          transactionsLoadError={
            transactionsLoadError
          }
          addTransaction={addTransaction}
          updateTransaction={updateTransaction}
          deleteTransaction={deleteTransaction}
          previewTransactionImport={
            previewTransactionImport
          }
          importTransactions={
            importTransactions
          }
        />
      )}
    </div>
  )
}

export default AuthenticatedShell