import { useState } from 'react'
import AuthForm from './components/AuthForm'
import TransactionsPage from './components/TransactionsPage'
import useAuth from './hooks/useAuth'
import './App.css'

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false)

  const {
    user,
    authStatus,
    authError,
    handleLogin,
    handleRegister,
    handleLogout,
    captureAuthGeneration,
    isCurrentAuthGeneration,
    expireAuthenticatedSession,
  } = useAuth()

  if (authStatus === 'checking') {
    return (
      <div
        className="empty-state"
        role="status"
      >
        <p>Verificando sessão...</p>
      </div>
    )
  }

  if (authStatus === 'error') {
    return (
      <div
        className="empty-state"
        role="alert"
      >
        <p>{authError}</p>
      </div>
    )
  }

  if (authStatus === 'loggingOut') {
    return (
      <div
        className="empty-state"
        role="status"
      >
        <p>Encerrando sessão...</p>
      </div>
    )
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="empty-state">
        <AuthForm
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </div>
    )
  }

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
        key={user.id}
        captureAuthGeneration={
          captureAuthGeneration
        }
        isCurrentAuthGeneration={
          isCurrentAuthGeneration
        }
        expireSession={
          expireAuthenticatedSession
        }
        onLogout={handleLogout}
      />
    </div>
  )
}

export default App