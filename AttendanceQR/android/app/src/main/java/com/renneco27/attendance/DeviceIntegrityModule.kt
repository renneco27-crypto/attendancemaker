package com.renneco27.attendance

import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class DeviceIntegrityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "DeviceIntegrity"

    @ReactMethod
    fun checkDeveloperOptions(promise: Promise) {
        try {
            val resolver = reactApplicationContext.contentResolver
            val devEnabled = Settings.Global.getInt(
                resolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0
            ) == 1
            val adbEnabled = Settings.Global.getInt(
                resolver, Settings.Global.ADB_ENABLED, 0
            ) == 1
            promise.resolve(devEnabled || adbEnabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun checkEmulator(promise: Promise) {
        val suspicious = listOf("generic", "unknown", "emulator", "sdk", "vbox", "genymotion")
        val fingerprint = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        val isEmulator = suspicious.any { fingerprint.contains(it) || model.contains(it) || hardware.contains(it) }
        promise.resolve(isEmulator)
    }

    @ReactMethod
    fun checkTestKeys(promise: Promise) {
        val tags = Build.TAGS ?: ""
        promise.resolve(tags.contains("test-keys"))
    }

    @ReactMethod
    fun getFullReport(promise: Promise) {
        val resolver = reactApplicationContext.contentResolver
        val map = Arguments.createMap()
        val devEnabled = try {
            Settings.Global.getInt(resolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
        } catch (e: Exception) { false }
        val adbOn = try {
            Settings.Global.getInt(resolver, Settings.Global.ADB_ENABLED, 0) == 1
        } catch (e: Exception) { false }
        val fingerprint = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        val suspicious = listOf("generic", "unknown", "emulator", "sdk", "vbox", "genymotion")
        val isEmulator = suspicious.any { fingerprint.contains(it) || model.contains(it) || hardware.contains(it) }
        val tags = Build.TAGS ?: ""
        map.putBoolean("devOptionsOn", devEnabled)
        map.putBoolean("adbOn", adbOn)
        map.putBoolean("isEmulator", isEmulator)
        map.putBoolean("isTestKeys", tags.contains("test-keys"))
        promise.resolve(map)
    }
}
