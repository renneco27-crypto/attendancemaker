import React, { useEffect, useRef, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NativeModules } from 'react-native'

const { DeviceIntegrity } = NativeModules
const WEBAPP_URL = 'https://attendancemaker-tsjz.onrender.com'

type Phase = 'checking' | 'blocked' | 'loading' | 'error' | 'app'

interface IntegrityReport {
  devOptionsOn?: boolean
  adbOn?: boolean
  isEmulator?: boolean
  isTestKeys?: boolean
  isJailbroken?: boolean
  isSimulator?: boolean
  hasSuspiciousFiles?: boolean
  canWriteOutsideSandbox?: boolean
  hasSuspiciousLibraries?: boolean
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('checking')
  const [blockReasons, setBlockReasons] = useState<string[]>([])
  const webviewRef = useRef<any>(null)

  useEffect(() => {
    checkDevice()
  }, [])

  async function checkDevice() {
    try {
      const report: IntegrityReport = await DeviceIntegrity.getFullReport()
      const reasons: string[] = []

      if (Platform.OS === 'android') {
        if (report.devOptionsOn) reasons.push('Developer Options are enabled')
        if (report.adbOn) reasons.push('USB Debugging is enabled')
        if (report.isEmulator) reasons.push('App cannot run on an emulator')
        if (report.isTestKeys) reasons.push('Device uses test-keys build')
      } else if (Platform.OS === 'ios') {
        if (report.isSimulator) reasons.push('App cannot run on a simulator')
        if (report.isJailbroken) reasons.push('Device is jailbroken')
      }

      if (reasons.length > 0) {
        setBlockReasons(reasons)
        setPhase('blocked')
      } else {
        setPhase('loading')
      }
    } catch {
      if (__DEV__) {
        setPhase('loading')
      } else {
        setPhase('blocked')
        setBlockReasons(['Unable to verify device security'])
      }
    }
  }

  function handleRetry() {
    setPhase('checking')
    checkDevice()
  }

  function handleExit() {
    BackHandler.exitApp()
  }

  if (phase === 'checking') {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="#4f8ef7" />
        <Text style={styles.loadingText}>Checking device security…</Text>
      </View>
    )
  }

  if (phase === 'blocked') {
    return (
      <View style={styles.overlay}>
        <Text style={styles.blockIcon}>🔒</Text>
        <Text style={styles.blockTitle}>Device Not Allowed</Text>
        {blockReasons.map((r, i) => (
          <Text key={i} style={styles.blockReason}>• {r}</Text>
        ))}
        <Text style={styles.blockHint}>
          {Platform.OS === 'android'
            ? 'Disable Developer Options and USB Debugging in Settings.'
            : 'This device does not meet security requirements.'}
        </Text>
        <Text style={styles.exitBtn} onPress={handleExit}>Exit</Text>
      </View>
    )
  }

  if (phase === 'error') {
    return (
      <View style={styles.overlay}>
        <Text style={styles.blockIcon}>📡</Text>
        <Text style={styles.blockTitle}>Connection Error</Text>
        <Text style={styles.blockHint}>Could not reach the attendance server.</Text>
        <Text style={styles.retryBtn} onPress={handleRetry}>Retry</Text>
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {phase === 'loading' && (
          <View style={styles.overlay}>
            <Text style={styles.appTitle}>Attendance</Text>
            <ActivityIndicator size="large" color="#4f8ef7" style={{ marginTop: 24 }} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        )}
        <WebView
          ref={webviewRef}
          source={{ uri: WEBAPP_URL }}
          style={styles.webview}
          onLoadStart={() => setPhase('loading')}
          onLoadEnd={() => setPhase('app')}
          onError={() => setPhase('error')}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          cacheEnabled={true}
          allowsProtectedMedia={true}
          mediaCapturePermissionGrantType="grant"
          androidLayerType="hardware"
          mixedContentMode="always"
          allowsBackForwardNavigationGestures={false}
          bounces={false}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
  overlay: {
    flex: 1, backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center',
    padding: 32,
  },
  loadingText: { color: '#8888aa', fontSize: 14, marginTop: 12 },
  appTitle: { color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  blockIcon: { fontSize: 48, marginBottom: 12 },
  blockTitle: { color: '#ff6b6b', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  blockReason: { color: '#ffb3b3', fontSize: 14, marginBottom: 6, textAlign: 'center' },
  blockHint: { color: '#8888aa', fontSize: 13, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  exitBtn: {
    marginTop: 28, color: '#4f8ef7', fontSize: 16, fontWeight: '600',
    paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: '#4f8ef7', borderRadius: 8, overflow: 'hidden',
  },
  retryBtn: {
    marginTop: 28, color: '#4f8ef7', fontSize: 16, fontWeight: '600',
    paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: '#4f8ef7', borderRadius: 8, overflow: 'hidden',
  },
})
