import React, { useState } from 'react'
import { supabase } from '../services/supabase'
import { getDeviceId } from '../utils/device'

interface Props {
  onBack: () => void
  onRegistered: (pin: string) => void
}

type Phase = 'form' | 'submitting' | 'success' | 'failed'

export default function RegisterDevice({ onBack, onRegistered }: Props) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit() {
    if (!name.trim() || pin.length !== 4 || pin !== pinConfirm) return
    setPhase('submitting')
    const deviceId = getDeviceId()

    const { data, error } = await supabase().functions.invoke('request-student-device', {
      body: { student_name: name.trim(), device_identifier: deviceId, pin },
    })

    if (error || !data?.success) {
      const reason = data?.reason ?? ''
      const serverMsg = data?.message || error?.message || JSON.stringify(error)
      console.error('Registration failed:', { reason, serverMsg, error, data })
      if (reason === 'STUDENT_NOT_FOUND') {
        setErrorMsg('Name not found. Make sure your teacher added you to the system first.')
      } else if (reason === 'AMBIGUOUS_NAME') {
        setErrorMsg('Multiple students found with that name. Ask your teacher to register you.')
      } else if (reason === 'ALREADY_APPROVED') {
        setErrorMsg('This name already has an approved device. Ask your teacher to delete it from the roster first.')
      } else {
        setErrorMsg('Error: ' + serverMsg)
      }
      setPhase('failed')
      return
    }

    setMessage('Device registered! You can now scan attendance.')
    setPhase('success')
  }

  function pinError() {
    if (pinConfirm.length === 0) return ''
    if (pin.length !== pinConfirm.length) return ''
    if (pin !== pinConfirm) return 'PINs do not match'
    return ''
  }

  return (
    <>
      <div className="dark-hero">
        <div className="dark-hero-bg" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div className="tb-logo">
            <div className="tb-logo-img"><img src="/photo_2.webp" alt="ACLC Ormoc" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div className="tb-brand" style={{ color: '#fff' }}>ACLC Ormoc <span style={{ color: 'rgba(255,255,255,.5)' }}>Attendance Scanner</span></div>
          </div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
        </div>
        <h2 style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Register Your Device</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.6 }}>Submit your name and create a 4-digit PIN. Your teacher will approve your device.</p>
      </div>
      <div className="reg-card">
        {phase === 'form' && (
          <div>
            <div className="field"><label>Full Name</label><input type="text" placeholder="e.g. Juan Dela Cruz" value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="field">
              <label>Create a 4-digit PIN</label>
              <input type="password" placeholder="Enter PIN" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </div>
            <div className="field">
              <label>Confirm PIN</label>
              <input type="password" placeholder="Re-enter PIN" maxLength={4} value={pinConfirm} onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </div>
            {pinError() && <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{pinError()}</div>}
            <button className="btn-primary" onClick={handleSubmit} disabled={!name.trim() || pin.length !== 4 || pin !== pinConfirm}>
              Submit Registration
            </button>
          </div>
        )}
        {phase === 'submitting' && (
          <div className="reg-result" style={{ padding: 40 }}>
            <div style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--green2)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <h3>Submitting…</h3>
          </div>
        )}
        {phase === 'success' && (
          <div className="reg-result">
            <div className="reg-icon">✅</div>
            <h3>Registered!</h3>
            <p>{message}</p>
            <button className="btn-primary mt24" onClick={() => onRegistered(pin)}>Continue to Scanner</button>
          </div>
        )}
        {phase === 'failed' && (
          <div className="reg-result">
            <div className="reg-icon">❌</div>
            <h3>Something went wrong</h3>
            <p>{errorMsg}</p>
            <button className="btn-primary mt24" onClick={() => { setPhase('form'); setErrorMsg(''); setPin(''); setPinConfirm('') }}>Try Again</button>
          </div>
        )}
      </div>
    </>
  )
}
