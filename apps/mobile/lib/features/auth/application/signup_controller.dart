import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_exceptions.dart';
import '../../../core/error/error_messages.dart';
import '../../../core/i18n/auth_th.dart';
import '../domain/validation.dart';
import 'auth_providers.dart';
import 'throttle_countdown_controller.dart';

/// D-023 PASS 2 — mirrors the fields `_SignupScreenState` held directly.
class SignupState {
  const SignupState({
    this.submitting = false,
    this.emailError,
    this.passwordError,
    this.generalError,
  });

  final bool submitting;
  final String? emailError;
  final String? passwordError;
  final String? generalError;

  SignupState copyWith({
    bool? submitting,
    String? emailError,
    bool clearEmailError = false,
    String? passwordError,
    bool clearPasswordError = false,
    String? generalError,
    bool clearGeneralError = false,
  }) {
    return SignupState(
      submitting: submitting ?? this.submitting,
      emailError: clearEmailError ? null : (emailError ?? this.emailError),
      passwordError: clearPasswordError ? null : (passwordError ?? this.passwordError),
      generalError: clearGeneralError ? null : (generalError ?? this.generalError),
    );
  }
}

/// Owns signup submission, client-side (on-blur + on-submit) validation, and
/// the throttle countdown — same responsibilities `_SignupScreenState` had,
/// now behind a Riverpod seam (D-023 §4: application layer owns every
/// repository call/loading/error/throttle transition).
///
/// ★ sanity-pass fix (Important #2): `AutoDispose` — same reasoning as
/// `LoginController`: a plain `Notifier` would keep stale validation/error
/// state (and an owned [throttle]) alive for the app's lifetime, leaking
/// into a fresh mount of `SignupScreen` after navigating away and back.
class SignupController extends AutoDisposeNotifier<SignupState> {
  final ThrottleCountdownController throttle = ThrottleCountdownController();

  // Guards the post-await continuations: if the screen is popped while a
  // request is in flight, autoDispose tears this notifier (and the owned
  // [throttle]) down — writing `state`/starting the throttle afterwards would
  // throw. Same job the old StatefulWidget `mounted` checks did. The truthful
  // outcome is still returned; only the state/throttle writes are skipped.
  bool _disposed = false;

  @override
  SignupState build() {
    ref.onDispose(() {
      _disposed = true;
      throttle.dispose();
    });
    return const SignupState();
  }

  bool get _throttled => throttle.isActive;

  /// Mirrors `_validateEmailOnBlur` — on-blur shape check only, does not
  /// touch password/general error state.
  void validateEmailOnBlur(String email) {
    state = state.copyWith(
      clearEmailError: email.isEmpty || isValidEmailShape(email),
      emailError: email.isEmpty || isValidEmailShape(email) ? null : AuthTh.signupErrorEmailInvalid,
    );
  }

  /// Returns the submitted email on success (the widget calls
  /// `onSignupSuccess(email)` with it) or null on failure/validation-block —
  /// same "no auto-login" contract as before.
  Future<String?> submit({required String email, required String password}) async {
    if (state.submitting || _throttled) return null;

    final trimmedEmail = email.trim();
    final emailError = isValidEmailShape(trimmedEmail) ? null : AuthTh.signupErrorEmailInvalid;
    final passwordError = isPasswordLongEnough(password) ? null : AuthTh.signupErrorPasswordTooShort;
    state = state.copyWith(
      clearGeneralError: true,
      emailError: emailError,
      clearEmailError: emailError == null,
      passwordError: passwordError,
      clearPasswordError: passwordError == null,
    );
    if (emailError != null || passwordError != null) return null;

    state = state.copyWith(submitting: true);
    try {
      await ref.read(authRepositoryProvider).signup(email: trimmedEmail, password: password);
      if (_disposed) return trimmedEmail;
      state = state.copyWith(submitting: false);
      return trimmedEmail;
    } on ApiError catch (e) {
      if (_disposed) return null;
      if (e.status == 429) {
        throttle.start(e.retryAfterSeconds ?? 60);
        state = state.copyWith(submitting: false);
      } else if (e.status == 422 || e.status == 409) {
        if (e.code == 'PASSWORD_TOO_SHORT' || e.code == 'PASSWORD_BREACHED') {
          state = state.copyWith(submitting: false, passwordError: signupErrorMessage(e.code));
        } else {
          state = state.copyWith(submitting: false, emailError: signupErrorMessage(e.code));
        }
      } else {
        state = state.copyWith(submitting: false, generalError: signupErrorMessage(e.code));
      }
      return null;
    } catch (_) {
      if (_disposed) return null;
      state = state.copyWith(submitting: false, generalError: AuthTh.signupErrorGeneric);
      return null;
    }
  }
}

final signupControllerProvider =
    AutoDisposeNotifierProvider<SignupController, SignupState>(SignupController.new);
