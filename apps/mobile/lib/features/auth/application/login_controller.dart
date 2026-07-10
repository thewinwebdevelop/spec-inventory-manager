import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_exceptions.dart';
import '../../../core/error/error_messages.dart';
import '../../../core/i18n/auth_th.dart';
import 'auth_providers.dart';
import 'throttle_countdown_controller.dart';

/// D-023 PASS 2 — state the `LoginScreen` widget watches. Mirrors the fields
/// the previous `_LoginScreenState` held directly (docs/mobile-architecture.md
/// §4: application layer owns "every repository call, loading/error/success
/// transition, throttle state, and navigation-triggering outcome").
///
/// `hasCredentialsError`/`generalError` model the SAME enumeration-safe 401
/// behavior as before (ux-wireframe §3.1): identical copy + border on BOTH
/// fields. [clearPasswordSignal] is a monotonically-bumped counter (not a
/// bool — a bool can't fire twice in a row with the same value) the widget
/// listens to in order to run the two effects that must stay in
/// presentation (clearing the `TextEditingController`, moving focus) without
/// the controller reaching into widget-owned objects.
class LoginState {
  const LoginState({
    this.submitting = false,
    this.hasCredentialsError = false,
    this.generalError,
    this.clearPasswordSignal = 0,
  });

  final bool submitting;
  final bool hasCredentialsError;
  final String? generalError;

  /// Bumped every time the password field must be cleared + refocused
  /// (401 path only) — see class doc.
  final int clearPasswordSignal;

  LoginState copyWith({
    bool? submitting,
    bool? hasCredentialsError,
    String? generalError,
    bool clearGeneralError = false,
    int? clearPasswordSignal,
  }) {
    return LoginState(
      submitting: submitting ?? this.submitting,
      hasCredentialsError: hasCredentialsError ?? this.hasCredentialsError,
      generalError: clearGeneralError ? null : (generalError ?? this.generalError),
      clearPasswordSignal: clearPasswordSignal ?? this.clearPasswordSignal,
    );
  }
}

/// Owns login submission + the throttle countdown (D-023: "every repository
/// call ... goes through the controller"). `ThrottleCountdownController`
/// itself stays a plain `ChangeNotifier` (unchanged from pass 1) — the
/// widget listens to it directly via `ThrottleBanner`/`AnimatedBuilder`
/// exactly as before; this controller only starts/owns/disposes it.
///
/// ★ sanity-pass fix (Important #2): `AutoDispose` — a plain `Notifier`
/// lives for the app's lifetime, so a stale `hasCredentialsError`/
/// `generalError` (or an in-flight throttle countdown) from a previous visit
/// to `LoginScreen` would still be showing on a fresh mount (e.g. after
/// logout -> login again). autoDispose tears this down (and, via
/// `ref.onDispose`, the owned [throttle]) once `LoginScreen` unmounts, so a
/// re-mount always starts from [LoginState]'s defaults.
class LoginController extends AutoDisposeNotifier<LoginState> {
  final ThrottleCountdownController throttle = ThrottleCountdownController();

  // Guards the post-await continuations: if the screen is popped while a
  // request is in flight, autoDispose tears this notifier (and the owned
  // [throttle]) down — writing `state`/starting the throttle afterwards would
  // throw. Same job the old StatefulWidget `mounted` checks did. The truthful
  // outcome is still returned; only the state/throttle writes are skipped.
  bool _disposed = false;

  @override
  LoginState build() {
    ref.onDispose(() {
      _disposed = true;
      throttle.dispose();
    });
    return const LoginState();
  }

  bool get _throttled => throttle.isActive;

  /// Returns true on success (the widget navigates via `onLoginSuccess` when
  /// this resolves true) — kept as a direct return value rather than a
  /// separate "success" state flag so the widget can `await` the outcome
  /// right at the call site (same shape as the original
  /// `_LoginScreenState._submit`'s `widget.onLoginSuccess()` call, just
  /// moved one layer up).
  Future<bool> submit({required String email, required String password}) async {
    if (state.submitting || _throttled) return false;

    state = state.copyWith(clearGeneralError: true, hasCredentialsError: false, submitting: true);

    try {
      await ref.read(authRepositoryProvider).login(email: email, password: password);
      if (_disposed) return true;
      state = state.copyWith(submitting: false);
      return true;
    } on ApiError catch (e) {
      if (_disposed) return false;
      if (e.status == 429) {
        throttle.start(e.retryAfterSeconds ?? 60);
        state = state.copyWith(submitting: false);
      } else if (e.status == 401) {
        // Enumeration-safe (ux-wireframe §3.1): identical copy + border on
        // BOTH fields, clear password, refocus password.
        state = state.copyWith(
          submitting: false,
          hasCredentialsError: true,
          generalError: loginErrorMessage(e.code),
          clearPasswordSignal: state.clearPasswordSignal + 1,
        );
      } else {
        state = state.copyWith(submitting: false, generalError: AuthTh.loginErrorGeneric);
      }
      return false;
    } catch (_) {
      if (_disposed) return false;
      state = state.copyWith(submitting: false, generalError: AuthTh.loginErrorGeneric);
      return false;
    }
  }
}

final loginControllerProvider =
    AutoDisposeNotifierProvider<LoginController, LoginState>(LoginController.new);
