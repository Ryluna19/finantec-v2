import { useRef, useState } from 'react'

function AuthForm({ onLogin }) {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)

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
      await onLogin({
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

  return (
    <section className="panel" aria-labelledby="login-title">
      <h1 id="login-title">Entrar</h1>

      <form
        className="transaction-form"
        onSubmit={handleSubmit}
      >
        <div className="form-field">
          <label htmlFor="login-username">
            Nome de usuário
          </label>

          <input
            id="login-username"
            name="username"
            autoComplete="username"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-field">
          <label htmlFor="login-password">
            Senha
          </label>

          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
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
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </section>
  )
}

export default AuthForm