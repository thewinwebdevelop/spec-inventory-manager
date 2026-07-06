import Flutter
import UIKit

/// T-001-17 ★ (L-5, client-security skill): backs
/// `apps/mobile/lib/auth/screenshot_guard.dart`'s `omnistock/screenshot_guard`
/// MethodChannel. iOS has no OS-level API to block screenshots/screen
/// recording (unlike Android's `FLAG_SECURE`) — the mitigation available on
/// this platform is covering the view with an opaque overlay right before
/// the app is backgrounded, so the OS's app-switcher snapshot (and the
/// visible frame during a screen recording taken from Control Center) never
/// shows the password field. The overlay is added/removed only while a
/// password-entry screen is mounted (Dart-side `ScreenshotGuardScope`).
@main
@objc class AppDelegate: FlutterAppDelegate {
  private var isScreenshotGuardEnabled = false
  private var privacyOverlay: UIView?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    if let controller = window?.rootViewController as? FlutterViewController {
      let channel = FlutterMethodChannel(
        name: "omnistock/screenshot_guard",
        binaryMessenger: controller.binaryMessenger
      )
      channel.setMethodCallHandler { [weak self] call, result in
        switch call.method {
        case "enable":
          self?.isScreenshotGuardEnabled = true
          result(nil)
        case "disable":
          self?.isScreenshotGuardEnabled = false
          self?.removePrivacyOverlay()
          result(nil)
        default:
          result(FlutterMethodNotImplemented)
        }
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func applicationDidEnterBackground(_ application: UIApplication) {
    if isScreenshotGuardEnabled {
      addPrivacyOverlay()
    }
    super.applicationDidEnterBackground(application)
  }

  override func applicationWillEnterForeground(_ application: UIApplication) {
    removePrivacyOverlay()
    super.applicationWillEnterForeground(application)
  }

  private func addPrivacyOverlay() {
    guard privacyOverlay == nil, let window = self.window else { return }
    let overlay = UIView(frame: window.bounds)
    overlay.backgroundColor = UIColor.white
    overlay.tag = 0x5EC12E // arbitrary marker tag, no functional meaning
    window.addSubview(overlay)
    privacyOverlay = overlay
  }

  private func removePrivacyOverlay() {
    privacyOverlay?.removeFromSuperview()
    privacyOverlay = nil
  }
}
