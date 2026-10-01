import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import AuthForm from './components/AuthForm'
import TransactionsPage from './components/TransactionsPage'
import './App.css'

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false)

  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] =
    useState('checking')

  const [authError, setAuthError] =
    useState(null)

  const authGenerationRef = useRef(0)

  const captureAuthGeneration = useCallback(
    () => authGenerationRef.current,
    [],
  )

  const isCurrentAuthGeneration = useCallback(
    (generation) =>
      authGenerationRef.current === generation,
    [],
  )

  const activateAuthenticatedUser = useCallback(
    (nextUser) => {
      // Uma nova identidade invalida qualquer requisição da identidade anterior.
      authGenerationRef.current += 1

      setUser(nextUser)
      setAuthError(null)
      setAuthStatus('authenticated')
    },
    [
      setUser,
      setAuthError,
      setAuthStatus,
    ],
  )

  const expireAuthenticatedSession = useCallback(
    (requestGeneration) => {
      if (
        authGenerationRef.current !==
        requestGeneration
      ) {
        return false
      }

      // Invalida imediatamente todas as requisições da sessão expirada.
      authGenerationRef.current += 1

      setUser(null)
      setAuthError(null)
      setAuthStatus('unauthenticated')

      return true
    },
    [
      setUser,
      setAuthError,
      setAuthStatus,
    ],
  )

  useEffect(() => {
    let isActive = true

    const authGenerationAtStart =
      authGenerationRef.current

    async function loadSession() {
      try {
        const response = await fetch(
          'http://localhost:3000/auth/me',
          {
            credentials: 'include',
          },
        )

        if (
          !isActive ||
          authGenerationRef.current !==
            authGenerationAtStart
        ) {
          return
        }

        if (response.status === 401) {
          setUser(null)
          setAuthError(null)
          setAuthStatus('unauthenticated')
          return
        }

        if (!response.ok) {
          throw new Error(
            'Não foi possível verificar a sessão.',
          )
        }

        const data = await response.json()

        if (
          !isActive ||
          authGenerationRef.current !==
            authGenerationAtStart
        ) {
          return
        }

        activateAuthenticatedUser(data.user)
      } catch (error) {
        if (
          !isActive ||
          authGenerationRef.current !==
            authGenerationAtStart
        ) {
          return
        }

        console.error(error)

        setUser(null)
        setAuthError(
          'Não foi possível verificar sua sessão.',
        )
        setAuthStatus('error')
      }
    }

    loadSession()

    return () => {
      isActive = false
    }
  }, [activateAuthenticatedUser])

  async function handleLogin(credentials) {
    const authGenerationAtStart =
      authGenerationRef.current

    try {
      const response = await fetch(
        'http://localhost:3000/auth/login',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(credentials),
        },
      )

      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      let data = null

      try {
        data = await response.json()
      } catch {
        if (
          authGenerationRef.current !==
          authGenerationAtStart
        ) {
          return
        }

        // Mantém a mensagem padrão se a resposta não possuir JSON válido.
      }

      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Não foi possível entrar na conta.',
        )
      }

      if (!data?.user) {
        throw new Error(
          'Não foi possível entrar na conta.',
        )
      }

      activateAuthenticatedUser(data.user)
    } catch (error) {
      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      throw error
    }
  }

  async function handleRegister(credentials) {
    const authGenerationAtStart =
      authGenerationRef.current

    try {
      const response = await fetch(
        'http://localhost:3000/auth/register',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(credentials),
        },
      )

      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      let data = null

      try {
        data = await response.json()
      } catch {
        if (
          authGenerationRef.current !==
          authGenerationAtStart
        ) {
          return
        }

        // Mantém a mensagem padrão se a resposta não possuir JSON válido.
      }

      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Não foi possível criar a conta.',
        )
      }

      if (!data?.user) {
        throw new Error(
          'Não foi possível criar a conta.',
        )
      }

      activateAuthenticatedUser(data.user)
    } catch (error) {
      if (
        authGenerationRef.current !==
        authGenerationAtStart
      ) {
        return
      }

      throw error
    }
  }

  async function handleLogout() {
    // Invalida imediatamente qualquer requisição pertencente
    // à identidade que está saindo.
    authGenerationRef.current += 1

    const logoutGeneration =
      authGenerationRef.current

    setUser(null)
    setAuthError(null)
    setAuthStatus('loggingOut')

    try {
      const response = await fetch(
        'http://localhost:3000/auth/logout',
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      if (
        authGenerationRef.current !==
        logoutGeneration
      ) {
        return
      }

      if (response.ok) {
        setAuthStatus('unauthenticated')
        return
      }
    } catch (error) {
      if (
        authGenerationRef.current !==
        logoutGeneration
      ) {
        return
      }

      console.error(error)
    }

    /*
     * Se o logout falhou, não sabemos se a sessão continuou
     * válida no servidor. Verificamos antes de decidir o que
     * mostrar ao usuário.
     */
    try {
      const response = await fetch(
        'http://localhost:3000/auth/me',
        {
          credentials: 'include',
        },
      )

      if (
        authGenerationRef.current !==
        logoutGeneration
      ) {
        return
      }

      if (response.status === 401) {
        setUser(null)
        setAuthError(null)
        setAuthStatus('unauthenticated')
        return
      }

      if (!response.ok) {
        throw new Error(
          'Não foi possível verificar a sessão após o logout.',
        )
      }

      const data = await response.json()

      if (
        authGenerationRef.current !==
        logoutGeneration
      ) {
        return
      }

      if (!data?.user) {
        throw new Error(
          'Não foi possível verificar a sessão após o logout.',
        )
      }

      // O logout falhou, mas a sessão anterior continua válida.
      // Uma nova área privada será montada e carregará seus dados novamente.
      activateAuthenticatedUser(data.user)
    } catch (error) {
      if (
        authGenerationRef.current !==
        logoutGeneration
      ) {
        return
      }

      console.error(error)

      setUser(null)
      setAuthError(
        'Não foi possível confirmar o encerramento da sessão.',
      )
      setAuthStatus('error')
    }
  }

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