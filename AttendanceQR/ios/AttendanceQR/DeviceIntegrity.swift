import UIKit

@objc(DeviceIntegrity)
class DeviceIntegrity: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func checkJailbreak(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(isJailbroken())
  }

  @objc
  func getFullReport(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    let report: [String: Any] = [
      "isJailbroken": isJailbroken(),
      "isSimulator": isSimulator(),
      "hasSuspiciousFiles": hasSuspiciousFiles(),
      "canWriteOutsideSandbox": canWriteOutsideSandbox(),
      "hasSuspiciousLibraries": hasSuspiciousDylibs()
    ]
    resolve(report)
  }

  private func isJailbroken() -> Bool {
    if isSimulator() { return false }
    return hasSuspiciousFiles() || canWriteOutsideSandbox() || canOpenCydiaURL() || hasSuspiciousDylibs()
  }

  private func isSimulator() -> Bool {
    #if targetEnvironment(simulator)
    return true
    #else
    return false
    #endif
  }

  private func hasSuspiciousFiles() -> Bool {
    let paths = [
      "/Applications/Cydia.app",
      "/Applications/Sileo.app",
      "/Applications/Zebra.app",
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/bin/bash",
      "/usr/sbin/sshd",
      "/etc/apt",
      "/private/var/lib/apt/",
      "/private/var/lib/cydia",
      "/private/var/stash",
      "/usr/bin/ssh",
      "/var/checkra1n.dmg",
      "/.bootstrapped_electra",
      "/usr/lib/libjailbreak.dylib"
    ]
    for path in paths {
      if FileManager.default.fileExists(atPath: path) {
        return true
      }
    }
    return false
  }

  private func canWriteOutsideSandbox() -> Bool {
    let testPath = "/private/jailbreak_test.txt"
    do {
      try "test".write(toFile: testPath, atomically: true, encoding: .utf8)
      try FileManager.default.removeItem(atPath: testPath)
      return true
    } catch {
      return false
    }
  }

  private func canOpenCydiaURL() -> Bool {
    guard let url = URL(string: "cydia://package/com.example.package") else { return false }
    var result = false
    if Thread.isMainThread {
      result = UIApplication.shared.canOpenURL(url)
    } else {
      DispatchQueue.main.sync {
        result = UIApplication.shared.canOpenURL(url)
      }
    }
    return result
  }

  private func hasSuspiciousDylibs() -> Bool {
    let suspiciousLibs = [
      "FridaGadget", "frida", "cynject", "libcycript",
      "SubstrateLoader", "SSLKillSwitch", "MobileSubstrate"
    ]
    let imageCount = _dyld_image_count()
    for i in 0..<imageCount {
      guard let imageName = _dyld_get_image_name(i) else { continue }
      let name = String(cString: imageName).lowercased()
      for lib in suspiciousLibs {
        if name.contains(lib.lowercased()) {
          return true
        }
      }
    }
    return false
  }
}
