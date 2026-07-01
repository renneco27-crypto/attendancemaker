import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { validateScan } from '../services/api'
import { getDeviceId } from '../utils/device'

interface Props {
  onBack: () => void
  pinValue: string
}

type ScanPhase = 'idle' | 'scanning' | 'success' | 'fail' | 'geo-fail'

const SCANNER_ID = 'qr-scanner'
const CAPTURE_WINDOW_MS = 2000

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface QrPayload {
  session_id: string
  rotation_key: string
}

export default function StudentScanner({ onBack, pinValue }: Props) {
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [geoText, setGeoText] = useState('Checking location…')
  const [capturedCount, setCapturedCount] = useState(0)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const capturedRef = useRef<QrPayload[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishingRef = useRef(false)

  useEffect(() => {
    checkGeo()
    return () => { stopScanner(); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function checkGeo() {
    if (!navigator.geolocation) { setGeoText('⚠️ Could not verify location'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, 11.0027, 124.6075)
        if (dist <= 300) setGeoText(`✅ On campus (${Math.round(dist)}m from gate)`)
        else { setGeoText(`❌ You are ${Math.round(dist)}m off campus`); setTimeout(() => setScanPhase('geo-fail'), 800) }
      },
      () => setGeoText('⚠️ Could not verify location'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  async function startScan() {
    setScanPhase('scanning')
    finishingRef.current = false
    capturedRef.current = []
    setCapturedCount(0)
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    try {
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 280, height: 280 } },
        onDecoded,
        () => {}
      )
      timerRef.current = setTimeout(finishCapture, CAPTURE_WINDOW_MS)
    } catch {
      setErrorMsg('Camera access denied. Grant camera permission and try again.')
      setScanPhase('fail')
    }
  }

  function onDecoded(text: string) {
    if (finishingRef.current) return
    try {
      const data = JSON.parse(text)
      const sid = data.session_id || data.s
      const rk = data.rotation_key || data.t
      if (!sid || !rk) return

      // avoid duplicate
      if (capturedRef.current.some(c => c.rotation_key === rk)) return

      capturedRef.current.push({ session_id: sid, rotation_key: rk })
      setCapturedCount(capturedRef.current.length)
    } catch {}
  }

  async function finishCapture() {
    if (finishingRef.current) return
    finishingRef.current = true
    await stopScanner()

    const caps = capturedRef.current
    if (caps.length < 2) {
      setErrorMsg(`Only ${caps.length} QR code(s) captured. Need at least 2.`)
      setScanPhase('fail')
      return
    }

    // Take the last two captured
    const last = caps[caps.length - 1]
    const prev = caps[caps.length - 2]

    setScanPhase('success')

    const result = await validateScan({
      session_id: last.session_id,
      rotation_key: last.rotation_key,
      previous_rotation_key: prev.rotation_key,
      student_device_id: getDeviceId(),
      pin: pinValue,
    })

    if (result.success) {
      setScanPhase('success')
    } else {
      const msg = !result.error ? 'Scan failed. Try again.'
        : result.error === 'Device not registered' ? 'Device not registered. Contact your teacher.'
        : result.error === 'Device not approved' ? 'Your device hasn\'t been approved yet.'
        : result.error === 'Session has ended' || result.error === 'Session expired' ? 'Session has ended.'
        : result.error === 'QR code expired, please rescan' ? 'QR code expired. Try again.'
        : result.error === 'Incorrect PIN' ? 'Incorrect PIN.'
        : result.error === 'Already checked in' ? 'You have already checked in for this session.'
        : result.error
      setErrorMsg(msg)
      setScanPhase('fail')
    }
  }

  async function stopScanner() {
    try { if (scannerRef.current) { await scannerRef.current.stop(); scannerRef.current.clear() } } catch {}
  }

  function resetScanner() {
    finishingRef.current = false
    capturedRef.current = []
    setCapturedCount(0)
    setErrorMsg('')
    setScanPhase('idle')
    checkGeo()
  }

  return (
    <>
      <div className="scanner-topbar">
        <div className="tb-logo-img"><div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gold)', color: '#fff', fontSize: 18, fontWeight: 800 }}>A</div></div>
        <div className="tb-brand" style={{ fontSize: 15, fontWeight: 800 }}>
          {scanPhase === 'success' ? 'Attendance Recorded!' : scanPhase === 'fail' ? 'Scan Failed' : 'QR Scanner'}
          <span>ACLC Ormoc · Attendance</span>
        </div>
      </div>

      {scanPhase === 'idle' && (
        <div className="scanner-body">
          <div className="geo-check">📍 <span>{geoText}</span></div>
          <div className="qr-viewport">
            <div className="qr-br" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 52 }}>📷</div>
            </div>
          </div>
          <div className="scan-hint">Point your camera at the QR code on your teacher's screen. Hold steady to capture two consecutive codes.</div>
          <div className="scanner-btns">
            <button className="btn-white" onClick={startScan}>▶ Start Camera</button>
            <button className="btn-white-ghost" onClick={onBack}>Cancel</button>
          </div>
        </div>
      )}

      {scanPhase === 'scanning' && (
        <div className="scanner-body">
          <div className="qr-viewport">
            <div className="qr-br" />
            <div className="scan-line" />
            <div id={SCANNER_ID} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="scan-hint" style={{ color: 'rgba(255,255,255,.9)' }}>Capturing QR codes… ({capturedCount} captured)</div>
          <div className="scanner-btns">
            <button className="btn-white-ghost" onClick={() => { stopScanner(); resetScanner() }}>Cancel</button>
          </div>
        </div>
      )}

      {scanPhase === 'success' && (
        <div className="scanner-body">
          <div className="result-icon success">✅</div>
          <div className="result-title">Attendance Recorded!</div>
          <div className="result-sub">Your attendance has been logged.</div>
          <div className="scanner-btns">
            <button className="btn-white" onClick={resetScanner}>Done</button>
          </div>
        </div>
      )}

      {scanPhase === 'fail' && (
        <div className="scanner-body">
          <div className="result-icon fail">✖</div>
          <div className="result-title">Scan Failed</div>
          <div className="result-sub">{errorMsg}</div>
          <div className="scanner-btns">
            <button className="btn-white" onClick={resetScanner}>Try Again</button>
            <button className="btn-white-ghost" onClick={onBack}>Back</button>
          </div>
        </div>
      )}

      {scanPhase === 'geo-fail' && (
        <div className="scanner-body">
          <div className="result-icon fail">📍</div>
          <div className="result-title">Outside Campus</div>
          <div className="result-sub">You must be on ACLC Ormoc campus to scan attendance.</div>
          <div className="scanner-btns">
            <button className="btn-white" onClick={resetScanner}>Retry Location</button>
            <button className="btn-white-ghost" onClick={onBack}>Back</button>
          </div>
        </div>
      )}
    </>
  )
}
