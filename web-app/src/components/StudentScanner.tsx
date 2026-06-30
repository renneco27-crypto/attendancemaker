import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { submitAttendance, CapturedToken } from '../services/api'
import { getDeviceId } from '../utils/device'

interface Props {
  onBack: () => void
  pinPassed: boolean
}

const CAPTURE_WINDOW_MS = 2000
const MIN_TOKENS = 2
const SCANNER_ID = 'qr-scanner'

type Phase = 'ready' | 'scanning' | 'capturing' | 'submitting' | 'success' | 'failed'

function failureMessage(reason: string | null): string {
  switch (reason) {
    case 'DEVICE_NOT_FOUND': return 'Device not registered. Contact your teacher.'
    case 'DEVICE_INACTIVE': return 'This device has been deactivated.'
    case 'INSUFFICIENT_TOKENS': return 'Could not capture enough QR codes. Try again.'
    case 'INVALID_TOKENS': return 'Invalid QR codes detected. Try again.'
    case 'SEQUENCE_ERROR': return 'QR codes out of sequence. Try again.'
    case 'TIMING_DRIFT': return 'Timing error. Try again.'
    case 'ALREADY_CHECKED_IN': return 'You have already checked in for this session.'
    case 'BIOMETRIC_FAILED': return 'Access verification failed. Restart the app.'
    case 'SERVER_ERROR': return 'Server error. Try again.'
    default: return 'An unknown error occurred. Try again.'
  }
}

export default function StudentScanner({ onBack, pinPassed }: Props) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [errorMsg, setErrorMsg] = useState('')
  const [tokensCaptured, setTokensCaptured] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const capturedRef = useRef<CapturedToken[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishingRef = useRef(false)

  async function startScanner() {
    setPhase('scanning')
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 280, height: 280 } },
        onDecoded,
        () => {}
      )
    } catch (err: any) {
      setErrorMsg('Camera access denied. Grant camera permission and try again.')
      setPhase('failed')
    }
  }

  function onDecoded(text: string) {
    if (finishingRef.current) return

    try {
      const data = JSON.parse(text)
      const token: CapturedToken = {
        token: data.t,
        sequence_index: data.i,
        capture_timestamp: Date.now(),
      }

      if (capturedRef.current.some(t => t.token === token.token)) return
      capturedRef.current.push(token)
      setTokensCaptured(capturedRef.current.length)

      if (capturedRef.current.length === 1) {
        setPhase('capturing')
        timerRef.current = setTimeout(finishCapture, CAPTURE_WINDOW_MS)
      }
    } catch {}
  }

  async function finishCapture() {
    if (finishingRef.current) return
    finishingRef.current = true

    await stopScanner()
    setPhase('submitting')

    const tokens = capturedRef.current
    if (tokens.length < MIN_TOKENS) {
      setErrorMsg(`Only ${tokens.length} token(s) captured. Need at least ${MIN_TOKENS}.`)
      setPhase('failed')
      return
    }

    const sorted = tokens.sort((a, b) => a.capture_timestamp - b.capture_timestamp)
    const result = await submitAttendance(getDeviceId(), sorted, pinPassed)

    if (result.success) {
      setPhase('success')
    } else {
      setPhase('failed')
      setErrorMsg(failureMessage(result.reason))
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
    } catch {}
  }

  function handleRetry() {
    capturedRef.current = []
    finishingRef.current = false
    setTokensCaptured(0)
    setErrorMsg('')
    setPhase('ready')
  }

  function handleDone() {
    stopScanner()
    onBack()
  }

  useEffect(() => {
    return () => { stopScanner(); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // -------- RENDER --------

  if (phase === 'ready') {
    return (
      <div className="screen scanner-screen">
        <h1 className="title">QR Scanner</h1>
        <p className="subtitle">Point camera at the teacher's QR code</p>
        <button className="btn btn-primary" onClick={startScanner}>
          Start Camera
        </button>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>
    )
  }

  if (phase === 'scanning' || phase === 'capturing') {
    return (
      <div className="screen scanner-screen">
        <div className="scanner-container" style={{ borderColor: phase === 'capturing' ? '#ff0000' : '#ccc' }}>
          <div id={SCANNER_ID} />
        </div>
        <p className="scanner-status">
          {phase === 'capturing' ? 'Capturing QR codes...' : 'Scanning for QR code...'}
        </p>
        <p className="token-count">Tokens captured: {tokensCaptured}</p>
        <button className="btn btn-ghost" onClick={() => { stopScanner(); onBack() }}>Cancel</button>
      </div>
    )
  }

  if (phase === 'submitting') {
    return (
      <div className="screen scanner-screen">
        <div className="spinner" />
        <p className="subtitle">Verifying attendance...</p>
      </div>
    )
  }

  if (phase === 'success') {
    return (
      <div className="screen scanner-screen">
        <div className="icon-success">&#10003;</div>
        <h1 className="title" style={{ color: '#16a34a' }}>Attendance Recorded!</h1>
        <p className="subtitle">You have been marked present.</p>
        <button className="btn btn-ghost" onClick={handleDone}>Done</button>
      </div>
    )
  }

  return (
    <div className="screen scanner-screen">
      <div className="icon-error">&#10007;</div>
      <p className="error-text">{errorMsg}</p>
      <button className="btn btn-primary" onClick={handleRetry}>Try Again</button>
      <button className="btn btn-ghost" onClick={handleDone}>Cancel</button>
    </div>
  )
}
