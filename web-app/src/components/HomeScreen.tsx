import React from 'react'

interface Props {
  onSelectRole: (role: 'student' | 'teacher' | 'register') => void
}

export default function HomeScreen({ onSelectRole }: Props) {
  return (
    <div className="screen home">
      <h1 className="title">Attendance Scanner</h1>
      <p className="subtitle">Select your role</p>
      <button className="btn btn-student" onClick={() => onSelectRole('student')}>
        I'm a Student
      </button>
      <button className="btn btn-teacher" onClick={() => onSelectRole('teacher')}>
        I'm a Teacher
      </button>
      <button className="btn btn-ghost" onClick={() => onSelectRole('register')} style={{ marginTop: 8 }}>
        Register My Device
      </button>
    </div>
  )
}
