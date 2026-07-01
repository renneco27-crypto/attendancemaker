import React, { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../services/supabase'
import { createSession, endSession, rotateSessionKey, revokeDevice } from '../services/api'
import { resetSupabaseClient } from '../services/supabase'

interface Props {
  onLogout: () => void
}

interface PendingRequest {
  id: string
  student_name: string
  device_identifier: string
  created_at: string
}

interface RosterEntry {
  id: string
  student_name: string
  created_at: string
  status: string
}

interface Attendee {
  id: string
  student_name: string
  scanned_at: string
}

type Tab = 'session' | 'registrations' | 'roster'

export default function TeacherSession({ onLogout }: Props) {
  const [teacherId, setTeacherId] = useState('')
  const teacherIdRef = useRef('')
  const [teacherName, setTeacherName] = useState('')
  const [className, setClassName] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [phase, setPhase] = useState<'setup' | 'active' | 'ended'>('setup')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [pendingList, setPendingList] = useState<PendingRequest[]>([])
  const [tab, setTab] = useState<Tab>('session')
  const [newStudentName, setNewStudentName] = useState('')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  interface PastClass { id: string; class_name: string }
  const [pastClasses, setPastClasses] = useState<PastClass[]>([])
  const [selectedChip, setSelectedChip] = useState('')
  const rotationTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => { init(); return () => cleanup() }, [])

  function cleanup() {
    if (rotationTimer.current) clearInterval(rotationTimer.current)
    if (channelRef.current) channelRef.current.unsubscribe()
  }

  async function init() {
    try {
      const { data: { user } } = await supabase().auth.getUser()
      if (!user) return
      teacherIdRef.current = user.id
      setTeacherId(user.id)
      setTeacherName(user.email?.split('@')[0]?.replace(/[.].*/, '') ??
        user.user_metadata?.full_name ?? 'Teacher')
      cleanupOldPending()
      fetchPastClasses(user.id)
      fetchRoster(user.id)
      fetchPending(user.id)
    } catch (e) {
      alert('Failed to initialize: ' + (e instanceof Error ? e.message : e))
    }
  }

  async function cleanupOldPending() {
    const cutoff = new Date(Date.now() - 2 * 86400000).toISOString()
    await supabase()
      .from('device_registrations')
      .delete()
      .lt('created_at', cutoff)
      .eq('device_identifier', '')
  }

  async function fetchPastClasses(uid: string) {
    const { data } = await supabase()
      .from('attendance_sessions')
      .select('id, class_name')
      .eq('teacher_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setPastClasses(data)
  }

  async function fetchRoster(uid?: string) {
    const tid = uid || teacherIdRef.current || teacherId
    if (!tid) return
    const { data, error } = await supabase()
      .from('device_registrations')
      .select('id, student_name, created_at, status')
      .eq('teacher_id', tid)
      .neq('status', 'revoked')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchRoster error:', error.message)
    if (data) setRoster(data as RosterEntry[])
  }

  async function fetchPending(uid?: string) {
    const tid = uid || teacherId
    if (!tid) return
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
    const { data, error } = await supabase()
      .from('device_registrations')
      .select('id, student_name, device_identifier, created_at')
      .eq('teacher_id', tid)
      .eq('status', 'pending')
      .neq('device_identifier', '')
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
    if (error) console.error('fetchPending error:', error.message)
    if (data) setPendingList(data as PendingRequest[])
  }

  async function handleApprove(requestId: string) {
    let uid = teacherIdRef.current || teacherId
    if (!uid) {
      const { data: { user } } = await supabase().auth.getUser()
      if (!user) return
      uid = user.id
      teacherIdRef.current = uid
      setTeacherId(uid)
    }
    const { error } = await supabase()
      .from('device_registrations')
      .update({ status: 'approved' })
      .eq('id', requestId)
      .eq('teacher_id', uid)
    if (!error) fetchPending()
  }

  async function handleReject(requestId: string) {
    const ok = await revokeDevice(requestId)
    if (ok) fetchPending()
  }

  async function handleAddStudent() {
    if (!newStudentName.trim()) return
    let uid = teacherIdRef.current || teacherId
    if (!uid) {
      const { data: { user } } = await supabase().auth.getUser()
      if (!user) { alert('Not authenticated. Please log out and log back in.'); return }
      uid = user.id
      teacherIdRef.current = uid
      setTeacherId(uid)
    }
    const name = newStudentName.trim()
    const { data: existing } = await supabase()
      .from('device_registrations')
      .select('id')
      .eq('teacher_id', uid)
      .eq('student_name', name)
      .neq('status', 'revoked')
      .maybeSingle()
    if (existing) { alert('Student "' + name + '" is already in the roster.'); return }
    const { error } = await supabase()
      .from('device_registrations')
      .insert({ student_name: name, teacher_id: uid, device_identifier: '', status: 'pending' })
    if (!error) { setNewStudentName(''); fetchRoster(uid) }
    else { alert('Failed to add student: ' + error.message) }
  }

  async function handleRemoveStudent(deviceRegistrationId: string) {
    const ok = await revokeDevice(deviceRegistrationId)
    if (ok) fetchRoster(teacherId)
  }

  function selectChip(name: string) {
    setSelectedChip(name)
    setClassName(name)
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Delete this class session and its attendance records?')) return
    await supabase().from('attendance_records').delete().eq('session_id', sessionId)
    await supabase().from('attendance_sessions').delete().eq('id', sessionId)
    fetchPastClasses(teacherIdRef.current || teacherId)
  }

  async function startSession() {
    if (!className.trim()) return
    let uid = teacherIdRef.current || teacherId
    if (!uid) {
      const { data: { user } } = await supabase().auth.getUser()
      if (!user) { alert('Not authenticated. Please log out and log back in.'); return }
      uid = user.id
      teacherIdRef.current = uid
      setTeacherId(uid)
    }
    let id, rotation_key
    try {
      const result = await createSession(className.trim(), uid)
      id = result.id
      rotation_key = result.rotation_key
    } catch (e: any) {
      alert('Failed to start session: ' + (e.message || e))
      return
    }
    sessionIdRef.current = id
    setSessionId(id)
    setPhase('active')
    renderQr(JSON.stringify({ session_id: id, rotation_key }))

    const channel = supabase().channel(`attendance_records:${id}`)
    channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'attendance_records',
      filter: `session_id=eq.${id}`,
    }, async (payload: any) => {
      const r = payload.new
      const { data: devReg } = await supabase()
        .from('device_registrations')
        .select('student_name')
        .eq('student_id', r.student_id)
        .eq('teacher_id', teacherId)
        .maybeSingle()
      setAttendees(prev => [...prev, { id: r.id, student_name: devReg?.student_name ?? 'Unknown', scanned_at: r.scanned_at }])
    })
    channel.subscribe()
    channelRef.current = channel
    rotationTimer.current = setInterval(rotateKey, 1000)
  }

  const rotateKey = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    const result = await rotateSessionKey(sid)
    if ('ended' in result && result.ended) {
      if (rotationTimer.current) clearInterval(rotationTimer.current)
      rotationTimer.current = null
      setPhase('ended')
      return
    }
    if ('rotation_key' in result) {
      renderQr(JSON.stringify({ session_id: sid, rotation_key: result.rotation_key }))
    }
  }, [])

  function renderQr(text: string) {
    QRCode.toDataURL(text, { width: 260, margin: 1 }, (err, url) => {
      if (!err) setQrDataUrl(url)
    })
  }

  async function handleEndSession() {
    const sid = sessionIdRef.current
    if (!sid) return
    if (rotationTimer.current) { clearInterval(rotationTimer.current); rotationTimer.current = null }
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null }
    setQrDataUrl('')
    await endSession(sid)
    sessionIdRef.current = null
    setPhase('ended')
  }

  function handleNewSession() {
    if (rotationTimer.current) { clearInterval(rotationTimer.current); rotationTimer.current = null }
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null }
    sessionIdRef.current = null
    setSessionId(null)
    setQrDataUrl('')
    setAttendees([])
    setSelectedChip('')
    setClassName('')
    setPhase('setup')
  }

  function handleLogout() {
    cleanup()
    onLogout()
  }

  return (
    <>
      <div className="teacher-topbar">
        <div className="teacher-topbar-row">
          <div className="tb-logo">
            <div className="tb-logo-img"><img src="/photo_2.webp" alt="ACLC Ormoc" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
            <div className="tb-brand">ACLC Ormoc <span>Teacher Panel</span></div>
          </div>
          <button onClick={handleLogout} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--red-lt)', color: 'var(--red)', border: '1px solid #f5c0c0', fontFamily: 'Inter,sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Logout</button>
        </div>
        <div className="teacher-tabs">
          <button className={`tab-btn ${tab === 'session' ? 'active' : ''}`} onClick={() => setTab('session')}>Session</button>
          <button className={`tab-btn ${tab === 'registrations' ? 'active' : ''}`} onClick={() => { setTab('registrations'); fetchPending() }}>Registrations</button>
          <button className={`tab-btn ${tab === 'roster' ? 'active' : ''}`} onClick={() => { setTab('roster'); fetchRoster() }}>Roster</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>

        {/* ── SESSION TAB ── */}
        <div className={`tab-panel ${tab === 'session' ? 'active' : ''}`} id="tab-session">

          {/* SETUP */}
          <div className={`session-phase ${phase !== 'setup' ? 'hidden' : ''}`} id="phase-setup">
            <div className="greet-card">
              <div className="greet-bg" />
              <div className="greet-content">
                <div className="gc-sub">Welcome back,</div>
                <div className="gc-name">{teacherName}</div>
                <div className="gc-meta" id="teacher-geo-meta">📍 ACLC Ormoc Campus</div>
              </div>
            </div>
            {pastClasses.length > 0 && <div className="chips-label">Recent Classes</div>}
            {pastClasses.length > 0 && (
              <div className="class-chips">
                {pastClasses.map(s => (
                  <div key={s.id} className={`chip ${selectedChip === s.class_name ? 'selected' : ''}`}>
                    <span className="chip-text" onClick={() => selectChip(s.class_name)}>{s.class_name}</span>
                    <span className="chip-x" onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}>×</span>
                  </div>
                ))}
              </div>
            )}
            <div className="field"><label>Class Name</label><input type="text" placeholder="e.g. Data Structures — Block A" value={className} onChange={e => { setClassName(e.target.value); setSelectedChip('') }} /></div>
            <button className="btn-primary" onClick={startSession} disabled={!className.trim()}>▶ Start Session</button>
          </div>

          {/* ACTIVE */}
          <div className={`session-phase ${phase !== 'active' ? 'hidden' : ''}`} id="phase-active">
            <div className="greet-card" style={{ marginBottom: 18 }}>
              <div className="greet-bg" />
              <div className="greet-content">
                <div className="gc-sub">Currently Running</div>
                <div className="gc-name">{className}</div>
                <div className="gc-meta">📍 ACLC Ormoc</div>
              </div>
              <div className="live-badge"><div className="live-dot" />LIVE</div>
            </div>

            <div className="qr-display-card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Show this QR to students</div>
              <div className="qr-content">
                {qrDataUrl ? <img src={qrDataUrl} alt="QR" /> : <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="qr-hint">Refreshes every 1s</div>
              </div>
            </div>

            <div className="att-table-card">
              <div className="att-table-head">
                <h3>Checked In</h3>
                <span className="count-badge">{attendees.length}</span>
              </div>
              {attendees.length === 0 ? (
                <div className="att-empty">Waiting for students to scan…</div>
              ) : (
                attendees.slice(-20).map((a, i) => (
                  <div key={a.id} className="att-row">
                    <div className="att-dot" />
                    <div className="att-num">{i + 1}</div>
                    <div className="att-name">{a.student_name}</div>
                    <div className="att-time">{new Date(a.scanned_at).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
            <button className="btn-danger" onClick={handleEndSession}>■ End Session</button>
          </div>

          {/* ENDED */}
          <div className={`session-phase ${phase !== 'ended' ? 'hidden' : ''}`} id="phase-ended">
            <div style={{ textAlign: 'center', padding: '20px 0 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12, animation: 'popIn .4s ease' }}>📊</div>
              <div style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Session Ended</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{attendees.length} student{attendees.length !== 1 ? 's' : ''} attended</div>
            </div>
            {attendees.length > 0 && (
              <div className="att-table-card" style={{ marginBottom: 16 }}>
                <div className="att-table-head"><h3>Final Attendance</h3><span className="count-badge">{attendees.length}</span></div>
                {attendees.map((a, i) => (
                  <div key={a.id} className="att-row">
                    <div className="att-num">{i + 1}</div>
                    <div className="att-name">{a.student_name}</div>
                    <div className="att-time">{new Date(a.scanned_at).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={handleNewSession}>+ New Session</button>
          </div>
        </div>

        {/* ── REGISTRATIONS TAB ── */}
        <div className={`tab-panel ${tab === 'registrations' ? 'active' : ''}`} id="tab-registrations">
          <div style={{ padding: '20px 16px 40px' }}>
            <div style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Pending Registrations</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Approve or reject student device requests.</div>
            {pendingList.length === 0 ? (
              <div className="att-empty">No pending requests.</div>
            ) : (
              <div className="reg-list-card">
                {pendingList.map(r => (
                  <div key={r.id} className="reg-row">
                    <div className="reg-student-name">{r.student_name}</div>
                    <div className="reg-device-id">Device: {r.device_identifier.slice(0, 12)}…</div>
                    <div className="reg-actions">
                      <button className="approve-btn" onClick={() => handleApprove(r.id)}>✓ Approve</button>
                      <button className="reject-btn" onClick={() => handleReject(r.id)}>✖ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ROSTER TAB ── */}
        <div className={`tab-panel ${tab === 'roster' ? 'active' : ''}`} id="tab-roster">
          <div style={{ padding: '20px 16px 40px' }}>
            <div style={{ fontFamily: "'Sora','Inter',sans-serif", fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Student Roster</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Manage registered students for this class.</div>
            <div className="roster-add">
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 4 }}>Add a Student</div>
              <div className="roster-add-row">
                <input type="text" placeholder="Full student name" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddStudent() }} />
                <button className="add-btn" onClick={handleAddStudent}>Add</button>
              </div>
            </div>
            <div className="section-title">Registered Students</div>
            {roster.length === 0 ? (
              <div className="att-empty">No students registered yet.</div>
            ) : (
              <div className="roster-list">
                {roster.map(r => (
                  <div key={r.id} className="roster-row">
                    <div className="roster-info">
                      <div className="roster-name">{r.student_name}</div>
                      <div className="roster-date">Registered {new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <span className={`status-pill ${r.status === 'approved' ? 'sp-approved' : r.status === 'pending' ? 'sp-pending' : 'sp-revoked'}`}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                    <button className="remove-btn" onClick={() => handleRemoveStudent(r.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
