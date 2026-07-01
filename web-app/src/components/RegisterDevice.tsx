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
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit() {
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
            : 'Something went wrong. Try again.'
      setErrorMsg(msg)
      setPhase('failed')
      return
    }

    setMessage('Your device has been registered. Ask your teacher to approve it.')
    setPhase('success')
  }

  return (
    <>
      <div className="dark-hero">
        <div className="dark-hero-bg" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div className="tb-logo">
            <div className="tb-logo-img"><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gold)', color: '#fff', fontSize: 18, fontWeight: 800 }}>A</div></div>
            <div className="tb-brand" style={{ color: '#fff' }}>ACLC Ormoc <span style={{ color: 'rgba(255,255,255,.5)' }}>Attendance Scanner</span></div>
          </div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>← Back</button>
        </div>
        <h2 style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Register Your Device</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14, lineHeight: 1.6 }}>Submit your name to link this device. Your teacher will approve it.</p>
      </div>
      <div className="reg-card">
        {phase === 'form' && (
          <div>
            <div className="field"><label>Full Name</label><input type="text" placeholder="e.g. Juan Dela Cruz" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }} /></div>
            <button className="btn-primary" onClick={handleSubmit}>Submit Request</button>
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
            <h3>Request Sent!</h3>
            <p>{message}</p>
            <button className="btn-primary mt24" onClick={onBack}>Done</button>
          </div>
        )}
        {phase === 'failed' && (
          <div className="reg-result">
            <div className="reg-icon">❌</div>
            <h3>Something went wrong</h3>
            <p>{errorMsg}</p>
            <button className="btn-primary mt24" onClick={() => { setPhase('form'); setErrorMsg('') }}>Try Again</button>
          </div>
        )}
      </div>
    </>
  )
}
