import React, { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../services/supabase'
import { createSession, endSession, rotateSessionKey, revokeDevice } from '../services/api'

interface Props {
  onLogout: () => void
}

interface AttendanceRecord {
  id: string
  student_id: string
  scanned_at: string
  student_name?: string
}

interface PendingRequest {
  id: string
  student_id: string
  new_device_identifier: string
  created_at: string
  students: { name: string } | null
}

interface RosterEntry {
  id: string
  student_name: string
  created_at: string
  status: string
}

type Tab = 'session' | 'registrations' | 'roster'

export default function TeacherSession({ onLogout }: Props) {
  const [teacherId, setTeacherId] = useState<string>('')
  const [className, setClassName] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'setup' | 'active' | 'ended'>('setup')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [attendees, setAttendees] = useState<AttendanceRecord[]>([])
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [tab, setTab] = useState<Tab>('session')
  const [newStudentName, setNewStudentName] = useState('')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [pastClasses, setPastClasses] = useState<string[]>([])
  const [rotationKey, setRotationKey] = useState<string>('')
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    init()
    return () => {
      if (rotationTimer.current) clearInterval(rotationTimer.current)
      if (channelRef.current) channelRef.current.unsubscribe()
    }
  }, [])

  async function init() {
    const { data: { user } } = await supabase().auth.getUser()
    if (user) {
      setTeacherId(user.id)
      fetchPastClasses(user.id)
      fetchRoster(user.id)
    }
    fetchPendingRequests()
  }

  async function fetchPastClasses(uid: string) {
    const { data } = await supabase()
      .from('attendance_sessions')
      .select('class_name')
      .eq('teacher_id', uid)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      const unique = [...new Set(data.map(r => r.class_name))]
      setPastClasses(unique)
    }
  }

  async function fetchRoster(uid: string) {
    const { data } = await supabase()
      .from('device_registrations')
      .select('id, student_name, created_at, status')
      .eq('teacher_id', uid)
      .order('created_at', { ascending: false })

    if (data) setRoster(data as RosterEntry[])
  }

  async function fetchPendingRequests() {
    const c = supabase()
    const { data } = await c
      .from('device_change_requests')
      .select(`id, student_id, new_device_identifier, created_at, students(name)`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (data) setPendingRequests(data as unknown as PendingRequest[])
  }

  async function handleApprove(requestId: string) {
    const { error } = await supabase().functions.invoke('approve-device-change', {
      body: { request_id: requestId, approve: true },
    })
    if (!error) fetchPendingRequests()
  }

  async function handleReject(requestId: string) {
    const { error } = await supabase().functions.invoke('approve-device-change', {
      body: { request_id: requestId, approve: false },
    })
    if (!error) fetchPendingRequests()
  }

  async function handleAddStudent() {
    if (!newStudentName.trim()) return
    const c = supabase()
    const { error } = await c
      .from('device_registrations')
      .insert({ student_name: newStudentName.trim(), teacher_id: teacherId, device_identifier: '', status: 'pending' })
    if (!error) {
      setNewStudentName('')
      fetchRoster(teacherId)
    }
  }

  async function handleRemoveStudent(deviceRegistrationId: string) {
    const ok = await revokeDevice(deviceRegistrationId)
    if (ok) fetchRoster(teacherId)
  }

  async function handleLogout() {
    if (rotationTimer.current) clearInterval(rotationTimer.current)
    if (channelRef.current) channelRef.current.unsubscribe()
    await supabase().auth.signOut()
    onLogout()
  }

  function renderQr(text: string) {
    QRCode.toDataURL(text, { width: 260, margin: 1 }, (err, url) => {
      if (!err) setQrDataUrl(url)
    })
  }

  async function startSession() {
    if (!className.trim() || !teacherId) return

    const { id, rotation_key } = await createSession(className.trim(), teacherId)
    setSessionId(id)
    setRotationKey(rotation_key)
    setPhase('active')

    renderQr(JSON.stringify({ session_id: id, rotation_key }))

    const channel = supabase().channel(`attendance_records:${id}`)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_records',
        filter: `session_id=eq.${id}`,
      },
      async (payload: any) => {
        const record = payload.new
        const c2 = supabase()
        const { data: devReg } = await c2
          .from('device_registrations')
          .select('student_name')
          .eq('student_id', record.student_id)
          .eq('teacher_id', teacherId)
          .maybeSingle()

        setAttendees(prev => [...prev, { ...record, student_name: devReg?.student_name ?? 'Unknown' }])
      }
    )
    channel.subscribe()
    channelRef.current = channel

    rotationTimer.current = setInterval(rotateKey, 2000)
  }

  const rotateKey = useCallback(async () => {
    if (!sessionId) return
    const result = await rotateSessionKey(sessionId)
    if ('ended' in result && result.ended) {
      if (rotationTimer.current) clearInterval(rotationTimer.current)
      rotationTimer.current = null
      setPhase('ended')
      return
    }
    if ('rotation_key' in result) {
      setRotationKey(result.rotation_key)
      renderQr(JSON.stringify({ session_id: sessionId, rotation_key: result.rotation_key }))
    }
  }, [sessionId])

  async function handleEndSession() {
    if (!sessionId) return
    if (rotationTimer.current) {
      clearInterval(rotationTimer.current)
      rotationTimer.current = null
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    setRotationKey('')
    setQrDataUrl('')
    await endSession(sessionId)
    setPhase('ended')
  }

  function handleNewSession() {
    if (rotationTimer.current) {
      clearInterval(rotationTimer.current)
      rotationTimer.current = null
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    setSessionId(null)
    setRotationKey('')
    setQrDataUrl('')
    setAttendees([])
    setClassName('')
    setPhase('setup')
  }

  return (
    <div className="screen" style={{ paddingTop: 16, justifyContent: 'flex-start' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`tab-btn ${tab === 'session' ? 'tab-active' : ''}`} onClick={() => setTab('session')}>Session</button>
          <button className={`tab-btn ${tab === 'registrations' ? 'tab-active' : ''}`} onClick={() => { setTab('registrations'); fetchPendingRequests() }}>
            Registrations {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </button>
          <button className={`tab-btn ${tab === 'roster' ? 'tab-active' : ''}`} onClick={() => { setTab('roster'); if (teacherId) fetchRoster(teacherId) }}>Roster</button>
        </div>
        <button className="btn btn-ghost" style={{ padding: '8px 16px', width: 'auto' }} onClick={handleLogout}>Logout</button>
      </div>

      {/* ─── REGISTRATIONS TAB ─── */}
      {tab === 'registrations' && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <h3 style={{ marginBottom: 12, color: '#333' }}>Pending Device Registrations</h3>
          {pendingRequests.length === 0 ? (
            <p style={{ color: '#999' }}>No pending requests.</p>
          ) : (
            pendingRequests.map(r => (
              <div key={r.id} className="request-card">
                <div>
                  <strong>{r.students?.name ?? 'Unknown'}</strong>
                  <p style={{ fontSize: 12, color: '#999', wordBreak: 'break-all' }}>{r.new_device_identifier}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }} onClick={() => handleApprove(r.id)}>Approve</button>
                  <button className="btn btn-danger" style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }} onClick={() => handleReject(r.id)}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── ROSTER TAB ─── */}
      {tab === 'roster' && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <h3 style={{ marginBottom: 12, color: '#333' }}>Add a Student</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="text-input"
              style={{ flex: 1 }}
              placeholder="Full name"
              value={newStudentName}
              onChange={e => setNewStudentName(e.target.value)}
            />
            <button className="btn btn-primary" style={{ padding: '8px 16px', width: 'auto' }} onClick={handleAddStudent}>Add</button>
          </div>
          <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            After adding, student can request device registration from the app.
          </p>

          <h3 style={{ marginTop: 20, marginBottom: 12, color: '#333' }}>Registered Students</h3>
          {roster.length === 0 ? (
            <p style={{ color: '#999' }}>No students registered yet.</p>
          ) : (
            roster.map(r => (
              <div key={r.id} className="request-card">
                <div style={{ flex: 1 }}>
                  <strong>{r.student_name}</strong>
                  <p style={{ fontSize: 12, color: '#999' }}>
                    Registered {new Date(r.created_at).toLocaleDateString()} &middot; {r.status}
                  </p>
                </div>
                {r.status === 'approved' && (
                  <button
                    className="btn btn-danger"
                    style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }}
                    onClick={() => handleRemoveStudent(r.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── SESSION TAB ─── */}
      {tab === 'session' && (
        <>
          {phase === 'setup' && (
            <>
              <h1 className="title">Start a Session</h1>
              {pastClasses.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, maxWidth: 400, justifyContent: 'center' }}>
                  {pastClasses.map(name => (
                    <button
                      key={name}
                      className="btn btn-ghost"
                      style={{ padding: '4px 12px', width: 'auto', fontSize: 13, border: '1px solid #ccc', borderRadius: 16 }}
                      onClick={() => setClassName(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              <input
                className="text-input"
                placeholder="Class name (e.g. Math 101)"
                value={className}
                onChange={e => setClassName(e.target.value)}
              />
              <button className="btn btn-primary" onClick={startSession} disabled={!className.trim()}>
                Start Session
              </button>
            </>
          )}

          {phase === 'active' && (
            <>
              <h1 className="title">{className}</h1>
              <p className="live-badge">LIVE &middot; {attendees.length} checked in</p>

              <div className="qr-display">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Session QR code" className="qr-image" />
                ) : (
                  <div className="spinner" />
                )}
                <p className="qr-hint">Students scan this QR code</p>
              </div>

              {attendees.length > 0 && (
                <div className="attendance-table-wrap">
                  <h3>Check-ins</h3>
                  <table className="attendance-table">
                    <thead>
                      <tr><th>Student</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {attendees.slice(-20).reverse().map(r => (
                        <tr key={r.id}>
                          <td>{r.student_name ?? 'Unknown'}</td>
                          <td>{new Date(r.scanned_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button className="btn btn-danger" onClick={handleEndSession}>End Session</button>
            </>
          )}

          {phase === 'ended' && (
            <>
              <h1 className="title">Session Ended</h1>
              <p className="subtitle">{attendees.length} student(s) checked in</p>
              {attendees.length > 0 && (
                <table className="attendance-table">
                  <thead><tr><th>Student</th><th>Time</th></tr></thead>
                  <tbody>
                    {attendees.map(r => (
                      <tr key={r.id}>
                        <td>{r.student_name ?? 'Unknown'}</td>
                        <td>{new Date(r.scanned_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button className="btn btn-primary" onClick={handleNewSession}>New Session</button>
            </>
          )}
        </>
      )}
    </div>
  )
}
