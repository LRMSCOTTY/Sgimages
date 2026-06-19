import { useState } from 'react'
import { useAuthStore } from '../../store/authStore.js'
import { register, login } from '../../lib/authAPI.js'

export default function AuthPage({ onBack }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      let data
      if (mode === 'register') {
        data = await register(email, password, name)
      } else {
        data = await login(email, password)
      }
      setAuth(data.token, data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-icon">🎬</span>
          <span className="auth-logo-text">ProvidAI</span>
        </div>

        <h2 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Start creating'}
        </h2>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to your account'
            : 'Create your free account — no credit card needed'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <div className="auth-field">
              <label>Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => { setMode('register'); setError(null) }}>Sign up free</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('login'); setError(null) }}>Sign in</button></>
          )}
        </div>

        {onBack && (
          <button className="auth-back" onClick={onBack}>← Back to home</button>
        )}
      </div>
    </div>
  )
}
