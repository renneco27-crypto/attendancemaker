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
  const [pinPassed, setPinPassed] = useState(false)

  function handleRoleSelect(role: 'student' | 'teacher' | 'register') {
    if (role === 'student') setPhase('pin')
    else if (role === 'teacher') setPhase('teacher-login')
    else setPhase('register')
  }

  function handlePinSuccess() {
    setPinPassed(true)
    setPhase('scanner')
  }

  function handleTeacherLogin() {
    setPhase('teacher')
  }

  function handleBack() {
    setPinPassed(false)
    setPhase('home')
  }

  return (
    <div className="app">
      {phase === 'home' && <HomeScreen onSelectRole={handleRoleSelect} />}
      {phase === 'pin' && <PINGate onSuccess={handlePinSuccess} onBack={handleBack} />}
      {phase === 'scanner' && <StudentScanner onBack={handleBack} pinPassed={pinPassed} />}
      {phase === 'teacher-login' && <TeacherLogin onLogin={handleTeacherLogin} onBack={handleBack} />}
      {phase === 'teacher' && <TeacherSession onLogout={handleBack} />}
      {phase === 'register' && <RegisterDevice onBack={handleBack} />}
    </div>
  )
}
