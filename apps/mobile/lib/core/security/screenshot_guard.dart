import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// T-001-17 ★ (L-5) — screenshot/app-switcher-snapshot protection for the
/// password-entry screens (login, signup, change-password). client-security
/// skill: sensitive input must not be trivially captured by a screenshot or
/// left visible in the OS app-switcher preview.
///
/// A first-party `MethodChannel` (no third-party plugin pulled in for a
/// 2-call surface) to a small native handler:
/// - **Android**: `Window.FLAG_SECURE` on the activity's window — blocks
///   screenshots/screen-recording system-wide and blanks the recent-apps
///   thumbnail while set.
/// - **iOS**: has no OS-level screenshot-blocking API (Apple does not expose
///   one) — the native side instead obscures the view in the app-switcher
///   snapshot (`applicationDidEnterBackground`), which is the standard/only
///   mitigation available on the platform for that specific leak surface.
///
/// [enable] and [disable] are **reference-counted** at the Dart layer (via
/// [ScreenshotGuardScope]) so multiple concurrently-mounted password fields
/// (e.g. `ChangePasswordForm` living inside `SecurityScreen` alongside other
/// widgets) don't fight over a single global on/off flag — the native flag
/// only actually clears once every requester has released it.
class ScreenshotGuard {
  ScreenshotGuard._();

  static const _channel = MethodChannel('omnistock/screenshot_guard');

  /// Best-effort — swallows any [PlatformException]/[MissingPluginException]
  /// so a platform without the native handler wired (or `flutter test`,
  /// which has no platform channel at all) never crashes a password screen
  /// over this being unavailable. This is defense-in-depth, not the primary
  /// control (the primary control is never logging/persisting the plaintext
  /// password — see PasswordField/TokenStore) — degrading silently to "no
  /// extra protection" is an acceptable fallback, a thrown exception here is
  /// not.
  static Future<void> _invoke(String method) async {
    try {
      await _channel.invokeMethod<void>(method);
    } on MissingPluginException {
      // No native handler registered (e.g. under `flutter test`, or a
      // platform/build variant that hasn't wired one yet) — no-op.
    } on PlatformException {
      // Native handler exists but errored — no-op (best-effort control).
    }
  }

  static Future<void> enable() => _invoke('enable');
  static Future<void> disable() => _invoke('disable');
}

/// Reference-counted enable/disable — call [acquire] in `initState` and the
/// returned callback in `dispose`. Guarantees the native guard is only
/// disabled once the LAST interested screen unmounts, never prematurely by
/// an unrelated sibling's dispose.
class ScreenshotGuardScope {
  ScreenshotGuardScope._();

  static int _refCount = 0;

  // D-022 ★ re-review fix (Minor #3 — FLAG_SECURE across activity
  // recreation): `enable()` is normally only invoked on the 0->1 refcount
  // transition. On Android, an activity recreation (config change, or the
  // OS reclaiming/recreating the Activity while the process survives) gets a
  // brand-new `Window` that does NOT inherit the previous window's
  // `FLAG_SECURE` — if a password screen stays mounted across that
  // recreation (refcount never drops to 0, so `acquire()` is never called
  // again), the new window is left unprotected. This one process-wide
  // `WidgetsBindingObserver` re-invokes `ScreenshotGuard.enable()` whenever
  // the app returns to `resumed` while `_refCount > 0`, which is exactly the
  // point a recreated Activity/Window becomes current again — cheap,
  // idempotent (native `enable` just re-sets a flag that's already correct
  // in the no-recreation case), and requires no widget in the tree.
  static _ScreenshotGuardLifecycleObserver? _observer;

  /// Increments the ref count, enabling the native guard on the 0->1
  /// transition. Returns a release callback — call it exactly once (e.g.
  /// from `dispose()`); calling it more than once is a no-op past 0 (never
  /// goes negative, never double-disables).
  static VoidCallback acquire() {
    _refCount++;
    if (_refCount == 1) {
      // Fire-and-forget: initState/dispose are synchronous; the native call
      // itself is async best-effort (see ScreenshotGuard._invoke).
      ScreenshotGuard.enable();
      _observer ??= _ScreenshotGuardLifecycleObserver()..attach();
    }
    var released = false;
    return () {
      if (released) return;
      released = true;
      _refCount--;
      if (_refCount <= 0) {
        _refCount = 0;
        ScreenshotGuard.disable();
        _observer?.detach();
        _observer = null;
      }
    };
  }

  /// Test-only reset — `flutter test` runs multiple widget tests in the same
  /// isolate, so the static ref count must not leak between tests.
  static void resetForTest() {
    _refCount = 0;
    _observer?.detach();
    _observer = null;
  }
}

/// D-022 (Minor #3): re-enables the native screenshot guard whenever the app
/// comes back to [AppLifecycleState.resumed] while a password screen is
/// still mounted (`_refCount > 0`) — covers an Android activity recreation
/// (new `Window`, so a fresh, unprotected `FLAG_SECURE` state) that a plain
/// refcount 0->1 transition would never observe, since the refcount never
/// changed across the recreation.
class _ScreenshotGuardLifecycleObserver with WidgetsBindingObserver {
  void attach() => WidgetsBinding.instance.addObserver(this);

  void detach() => WidgetsBinding.instance.removeObserver(this);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && ScreenshotGuardScope._refCount > 0) {
      ScreenshotGuard.enable();
    }
  }
}
