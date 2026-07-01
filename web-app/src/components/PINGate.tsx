import React, { useState } from 'react'

interface Props {
  onSuccess: (pin: string) => void
  onBack: () => void
}

const CORRECT_PIN = '1234'

export default function PINGate({ onSuccess, onBack }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function key(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === 4) {
      setTimeout(() => {
        if (next === CORRECT_PIN) {
          onSuccess(next)
        } else {
          setError(true)
          setTimeout(() => setPin(''), 900)
        }
      }, 120)
    }
  }

  function del() {
    setPin(p => p.slice(0, -1))
    setError(false)
  }

  function dotClass(i: number) {
    if (error) return 'pin-dot error'
    if (i < pin.length) return 'pin-dot filled'
    return 'pin-dot'
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
        <h2 style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Enter Access Code</h2>
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 14 }}>4-digit PIN required to scan</p>
      </div>
      <div className="pin-card">
        <div className="pin-dots">
          <div className={dotClass(0)} />
          <div className={dotClass(1)} />
          <div className={dotClass(2)} />
          <div className={dotClass(3)} />
        </div>
        <div className="pin-error">{error ? 'Incorrect PIN. Try again.' : ''}</div>
        <div className="pin-pad">
          <button className="pin-key" onClick={() => key('1')}>1</button>
          <button className="pin-key" onClick={() => key('2')}>2</button>
          <button className="pin-key" onClick={() => key('3')}>3</button>
          <button className="pin-key" onClick={() => key('4')}>4</button>
          <button className="pin-key" onClick={() => key('5')}>5</button>
          <button className="pin-key" onClick={() => key('6')}>6</button>
          <button className="pin-key" onClick={() => key('7')}>7</button>
          <button className="pin-key" onClick={() => key('8')}>8</button>
          <button className="pin-key" onClick={() => key('9')}>9</button>
          <button className="pin-key zero" onClick={() => key('0')}>0</button>
          <button className="pin-key del" onClick={del}>⌫</button>
        </div>
      </div>
    </>
  )
}
