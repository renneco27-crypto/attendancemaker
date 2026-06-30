import React, { useState } from 'react'

interface Props {
  onSuccess: () => void
  onBack: () => void
}

const ACCESS_PIN = '1234'

export default function PINGate({ onSuccess, onBack }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pin === ACCESS_PIN) {
      onSuccess()
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  return (
    <div className="screen pin-gate">
      <h1 className="title">Enter Access Code</h1>
      <p className="subtitle">Enter the class PIN to continue</p>
      <form onSubmit={handleSubmit} className="pin-form">
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => { setPin(e.target.value); setError('') }}
          placeholder="0000"
          autoFocus
        />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={pin.length < 4}>
          Continue
        </button>
      </form>
      <button className="btn btn-ghost" onClick={onBack}>Back</button>
    </div>
  )
}
