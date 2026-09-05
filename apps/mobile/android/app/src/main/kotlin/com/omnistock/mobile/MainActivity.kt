package com.omnistock.mobile

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * T-001-17 ★ (L-5, client-security skill): backs
 * `apps/mobile/lib/core/security/screenshot_guard.dart`'s `omnistock/screenshot_guard`
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

        // ★ M-07 (client-security): backs
        // `apps/mobile/lib/core/security/sensitive_clipboard.dart`. A national
        // ID must not be previewed by the system or synced to a paired
        // Chromebook. `EXTRA_IS_SENSITIVE` suppresses the Android 13+ clipboard
        // preview; below 13 there is no such flag and the plain copy is all the
        // platform offers.
        //
        // The Dart side and this handler are paired only by the channel name —
        // nothing compiles the pair, so each end names the other. The
        // screenshot-guard comment above pointed at a path that had moved,
        // which is what that costs (audit, 2026-08-25).
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "omnistock/sensitive_clipboard",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "copy" -> {
                    val text = call.argument<String>("text")
                    if (text == null) {
                        result.error("BAD_ARGS", "text is required", null)
                        return@setMethodCallHandler
                    }
                    val clipboard =
                        getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText(null, text)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        clip.description.extras = PersistableBundle().apply {
                            putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true)
                        }
                    }
                    clipboard.setPrimaryClip(clip)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }
    }
}
