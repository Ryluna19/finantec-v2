import AuthForm from './components/AuthForm'
import AuthenticatedShell from './components/AuthenticatedShell'
import useAuth from './hooks/useAuth'
import './App.css'

function App() {
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
    <AuthenticatedShell
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
  )
}

export default App