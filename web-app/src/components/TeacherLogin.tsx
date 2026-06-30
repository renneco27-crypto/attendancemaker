import React, { useState } from 'react'
import { supabase } from '../services/supabase'

interface Props {
  onLogin: () => void
  onBack: () => void
}

export default function TeacherLogin({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase().auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    onLogin()
  }

  return (
    <div className="screen">
      <h1 className="title">Teacher Login</h1>
      <form onSubmit={handleSubmit} className="pin-form" style={{ maxWidth: 320 }}>
        <input
          className="text-input"
          type="email"
          placeholder="teacher@school.edu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="text-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  )
}
