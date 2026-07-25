package com.omnistock.mobile

import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * T-001-17 ★ (L-5, client-security skill): backs
 * `apps/mobile/lib/auth/screenshot_guard.dart`'s `omnistock/screenshot_guard`
 * MethodChannel. `FLAG_SECURE` blocks screenshots/screen-recording for this
 * activity's window system-wide and blanks its thumbnail in the
 * recent-apps/app-switcher view while set — used only while a password-entry
 * screen (login/signup/change-password) is mounted, per the Dart-side
 * reference-counted `ScreenshotGuardScope`.
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "omnistock/screenshot_guard",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "enable" -> {
                    window.setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE,
                    )
                    result.success(null)
                }
                "disable" -> {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
