import AuthForm from '../features/auth/AuthForm'
import AuthenticatedShell from './AuthenticatedShell'
import useAuth from '../features/auth/useAuth'
import '../App.css'

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
      <main className="auth-screen">
        <AuthForm
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </main>
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