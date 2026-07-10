import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/refresh_coordinator.dart';
import '../data/auth_exceptions.dart';
import '../../../core/error/error_messages.dart';
import '../../../core/i18n/auth_th.dart';
import '../domain/validation.dart';
import 'auth_providers.dart';
import 'throttle_countdown_controller.dart';

/// D-023 PASS 2 — mirrors the fields `_ChangePasswordFormState` held
/// directly. [ChangePasswordOutcome] distinguishes the 3 terminal shapes the
/// widget must react to differently: a plain in-place error render
/// (`failure`, covered by the state fields below), the session-expired
/// navigation ([ChangePasswordOutcome.sessionExpired]), and success
/// ([ChangePasswordOutcome.success], which also carries the "clear both
/// fields" instruction back to the widget).
enum ChangePasswordOutcome { success, sessionExpired, failure }

class ChangePasswordState {
  const ChangePasswordState({
    this.submitting = false,
    this.currentError,
    this.newError,
    this.generalError,
  });

  final bool submitting;
  final String? currentError;
  final String? newError;
  final String? generalError;

  ChangePasswordState copyWith({
    bool? submitting,
    String? currentError,
    bool clearCurrentError = false,
    String? newError,
    bool clearNewError = false,
    String? generalError,
    bool clearGeneralError = false,
  }) {
    return ChangePasswordState(
      submitting: submitting ?? this.submitting,
      currentError: clearCurrentError ? null : (currentError ?? this.currentError),
      newError: clearNewError ? null : (newError ?? this.newError),
      generalError: clearGeneralError ? null : (generalError ?? this.generalError),
    );
  }
}

/// Owns change-password submission + the throttle countdown — same
/// responsibilities `_ChangePasswordFormState` had (US-6, D-008,
/// ux-wireframe §9).
///
/// ★ sanity-pass fix (Important #2): `AutoDispose` — same reasoning as
/// `LoginController`/`SignupController`: without it, stale error state (and
/// an owned [throttle]) would survive for the app's lifetime rather than
/// being torn down when `ChangePasswordForm`/`SecurityScreen` unmounts.
class ChangePasswordController extends AutoDisposeNotifier<ChangePasswordState> {
  final ThrottleCountdownController throttle = ThrottleCountdownController();

  // Guards the post-await continuations: if the screen is popped while a
  // request is in flight, autoDispose tears this notifier (and the owned
  // [throttle]) down — writing `state`/starting the throttle afterwards would
  // throw. Same job the old StatefulWidget `mounted` checks did. The truthful
  // outcome is still returned; only the state/throttle writes are skipped.
  bool _disposed = false;

  @override
  ChangePasswordState build() {
    ref.onDispose(() {
      _disposed = true;
      throttle.dispose();
    });
    return const ChangePasswordState();
  }

  bool get _throttled => throttle.isActive;

  Future<ChangePasswordOutcome> submit({
    required String currentPassword,
    required String newPassword,
  }) async {
    if (state.submitting || _throttled) return ChangePasswordOutcome.failure;

    final newError = isPasswordLongEnough(newPassword) ? null : AuthTh.changePasswordErrorPasswordTooShort;
    state = state.copyWith(
      clearGeneralError: true,
      clearCurrentError: true,
      newError: newError,
      clearNewError: newError == null,
    );
    if (newError != null) return ChangePasswordOutcome.failure;

    state = state.copyWith(submitting: true);
    try {
      await ref.read(authRepositoryProvider).changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword,
          );
      if (_disposed) return ChangePasswordOutcome.success;
      state = state.copyWith(submitting: false);
      return ChangePasswordOutcome.success;
    } on SessionExpiredException {
      if (_disposed) return ChangePasswordOutcome.sessionExpired;
      state = state.copyWith(submitting: false);
      return ChangePasswordOutcome.sessionExpired;
    } on ApiError catch (e) {
      if (_disposed) return ChangePasswordOutcome.failure;
      if (e.status == 429) {
        throttle.start(e.retryAfterSeconds ?? 60);
        state = state.copyWith(submitting: false);
      } else if (e.status == 401) {
        state = state.copyWith(submitting: false, currentError: changePasswordErrorMessage(e.code));
      } else if (e.status == 422) {
        state = state.copyWith(submitting: false, newError: changePasswordErrorMessage(e.code));
      } else {
        state = state.copyWith(submitting: false, generalError: AuthTh.changePasswordErrorGeneric);
      }
      return ChangePasswordOutcome.failure;
    } catch (_) {
      if (_disposed) return ChangePasswordOutcome.failure;
      state = state.copyWith(submitting: false, generalError: AuthTh.changePasswordErrorGeneric);
      return ChangePasswordOutcome.failure;
    }
  }
}

final changePasswordControllerProvider =
    AutoDisposeNotifierProvider<ChangePasswordController, ChangePasswordState>(ChangePasswordController.new);
