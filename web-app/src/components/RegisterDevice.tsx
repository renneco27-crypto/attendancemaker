import React, { useState } from 'react'
import { supabase } from '../services/supabase'
import { getDeviceId } from '../utils/device'

interface Props {
  onBack: () => void
}

type Phase = 'form' | 'submitting' | 'success' | 'failed'

export default function RegisterDevice({ onBack }: Props) {
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setPhase('submitting')
    const deviceId = getDeviceId()

    const { data, error } = await supabase().functions.invoke('request-student-device', {
      body: { student_name: name.trim(), device_identifier: deviceId },
    })

    if (error || !data?.success) {
      const reason = data?.reason ?? 'SERVER_ERROR'
      const msg =
        reason === 'STUDENT_NOT_FOUND'
          ? 'Name not found. Make sure your teacher added you to the system first.'
          : reason === 'AMBIGUOUS_NAME'
            ? 'Multiple students found with that name. Ask your teacher to register you.'
            : reason === 'PENDING_EXISTS'
              ? 'You already have a pending request. Wait for your teacher to approve it.'
              : 'Something went wrong. Try again.'
      setMessage(msg)
      setPhase('failed')
      return
    }

    setMessage(data?.message ?? 'Request submitted!')
    setPhase('success')
  }

  return (
    <div className="screen">
      <h1 className="title">Register Your Device</h1>

      {phase === 'form' && (
        <form onSubmit={handleSubmit} className="pin-form">
          <p className="subtitle">Enter your full name as registered by your teacher</p>
          <input
            className="text-input"
            type="text"
            placeholder="Your full name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
            Submit Request
          </button>
        </form>
      )}

      {phase === 'submitting' && (
        <>
          <div className="spinner" />
          <p className="subtitle">Submitting request...</p>
        </>
      )}

      {phase === 'success' && (
        <>
          <div className="icon-success">&#10003;</div>
          <p className="subtitle" style={{ marginTop: 8 }}>{message}</p>
          <button className="btn btn-ghost" onClick={onBack}>Done</button>
        </>
      )}

      {phase === 'failed' && (
        <>
          <div className="icon-error">&#10007;</div>
          <p className="error-text">{message}</p>
          <button className="btn btn-primary" onClick={() => { setPhase('form'); setMessage('') }}>
            Try Again
          </button>
          <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
        </>
      )}
    </div>
  )
}
