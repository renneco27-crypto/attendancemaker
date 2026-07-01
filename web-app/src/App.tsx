import React, { useState } from 'react'
import HomeScreen from './components/HomeScreen'
import PINGate from './components/PINGate'
import StudentScanner from './components/StudentScanner'
import TeacherLogin from './components/TeacherLogin'
import TeacherSession from './components/TeacherSession'
import RegisterDevice from './components/RegisterDevice'
import './App.css'

type Phase = 'home' | 'pin' | 'scanner' | 'teacher-login' | 'teacher' | 'register'

export default function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [pinValue, setPinValue] = useState('')

  function go(id: Phase) { setPhase(id); window.scrollTo(0, 0) }
  function handlePinSuccess(pin: string) { setPinValue(pin); setPhase('scanner') }

  return (
    <div className="app">
      <div className={`screen ${phase === 'home' ? 'active' : ''}`} id="home">
        <HomeScreen onSelectRole={(role) => go(role === 'student' ? 'pin' : role === 'teacher' ? 'teacher-login' : 'register')} />
      </div>
      <div className={`screen ${phase === 'pin' ? 'active' : ''}`} id="pin">
        <PINGate onSuccess={handlePinSuccess} onBack={() => go('home')} />
      </div>
      <div className={`screen ${phase === 'scanner' ? 'active' : ''}`} id="scanner">
        <StudentScanner onBack={() => go('home')} pinValue={pinValue} />
      </div>
      <div className={`screen ${phase === 'register' ? 'active' : ''}`} id="register">
        <RegisterDevice onBack={() => go('home')} />
      </div>
      <div className={`screen ${phase === 'teacher-login' ? 'active' : ''}`} id="teacher-login">
        <TeacherLogin onLogin={() => go('teacher')} onBack={() => go('home')} />
      </div>
      <div className={`screen ${phase === 'teacher' ? 'active' : ''}`} id="teacher-dash">
        <TeacherSession onLogout={() => go('home')} />
      </div>
    </div>
  )
}
