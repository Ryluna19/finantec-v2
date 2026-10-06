import { useRef, useState } from 'react'

function AuthForm({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const isSubmittingRef = useRef(false)

  const isRegisterMode = mode === 'register'

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmittingRef.current) {
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)

    const username = formData.get('username')
    const password = formData.get('password')

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const authenticate = isRegisterMode
        ? onRegister
        : onLogin

      await authenticate({
        username,
        password,
      })

      setError('')
      form.reset()
    } catch (error) {
      setError(error.message)
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  function handleModeChange() {
    setError('')

    setMode((current) =>
      current === 'login'
        ? 'register'
        : 'login',
    )
  }

  return (
    <section
      className="auth-shell"
      aria-labelledby="auth-title"
    >
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <span className="auth-eyebrow">
            Organização financeira
          </span>

          <strong className="auth-brand-name">
            FinanTec
          </strong>

          <p className="auth-brand-description">
            Organize suas receitas, despesas e
            reservas em um só lugar.
          </p>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-heading">
            <h1 id="auth-title">
              {isRegisterMode
                ? 'Criar conta'
                : 'Entrar'}
            </h1>

            <p>
              {isRegisterMode
                ? 'Crie sua conta para começar a organizar suas finanças.'
                : 'Acesse sua conta para continuar.'}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >
            <div className="form-field">
              <label htmlFor="auth-username">
                Nome de usuário
              </label>

              <input
                id="auth-username"
                name="username"
                autoComplete="username"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="form-field">
              <label htmlFor="auth-password">
                Senha
              </label>

              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={
                  isRegisterMode
                    ? 'new-password'
                    : 'current-password'
                }
                required
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <p
                className="auth-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="submit-button auth-primary-action"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isRegisterMode
                  ? 'Criando conta...'
                  : 'Entrando...'
                : isRegisterMode
                  ? 'Criar conta'
                  : 'Entrar'}
            </button>

            <button
              className="auth-secondary-action"
              type="button"
              onClick={handleModeChange}
              disabled={isSubmitting}
            >
              {isRegisterMode
                ? 'Voltar para entrar'
                : 'Criar uma conta'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

export default AuthForm