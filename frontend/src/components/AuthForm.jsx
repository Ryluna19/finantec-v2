import { useRef, useState } from 'react'

function AuthForm({ onLogin, onRegister }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      current === 'login' ? 'register' : 'login',
    )
  }

  return (
    <section className="panel" aria-labelledby="auth-title">
      <h1 id="auth-title">
        {isRegisterMode ? 'Criar conta' : 'Entrar'}
      </h1>

      <form
        className="transaction-form"
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
          <p role="alert">
            {error}
          </p>
        )}

        <button
          className="submit-button"
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
          type="button"
          onClick={handleModeChange}
          disabled={isSubmitting}
        >
          {isRegisterMode
            ? 'Voltar para entrar'
            : 'Criar uma conta'}
        </button>
      </form>
    </section>
  )
}

export default AuthForm