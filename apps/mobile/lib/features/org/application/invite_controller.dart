import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../domain/repositories/org_repository.dart';
import 'invite_error.dart';
import 'org_providers.dart';
import 'paged_controllers.dart';

class InviteState {
  const InviteState({this.submitting = false, this.error});

  final bool submitting;
  final InviteError? error;
}

/// T-002-M3 — S7's submit.
///
/// The invitation LINK is not held here. `createInvitation` returns the raw
/// token once — the server keeps only its hash (D-018) — and it is handed
/// straight back to the caller, which shows it and drops it. Parking it in a
/// controller that outlives the sheet would mean the one-time link is
/// recoverable after the person closed the panel, which is the property
/// D-018 removes on purpose.
class InviteController extends AutoDisposeNotifier<InviteState> {
  bool _disposed = false;

  @override
  InviteState build() {
    ref.onDispose(() => _disposed = true);
    return const InviteState();
  }

  Future<IssuedInvite?> submit({required String rawEmail, required String? roleId}) async {
    if (state.submitting) return null;

    final email = rawEmail.trim();
    if (email.isEmpty) {
      state = const InviteState(error: InviteFieldError(InviteFieldProblem.emailInvalid));
      return null;
    }
    if (roleId == null) {
      // AC US-3 makes the role mandatory; the button is disabled without one,
      // so this is the belt to that braces.
      state = const InviteState(error: InviteRoleUnavailable());
      return null;
    }

    state = const InviteState(submitting: true);
    try {
      final issued = await ref
          .read(orgScopedRepositoryProvider)
          .createInvitation(email: email, roleId: roleId);
      if (_disposed) return issued;

      // The pending section now has a row it does not know about. Invalidated
      // rather than optimistically appended: the row's `status` and
      // `expiresAt` are the server's to decide (`expired` is computed at read
      // time), and a locally-built row would be the client's guess at both.
      ref.invalidate(invitationsControllerProvider);
      state = const InviteState();
      return issued;
    } on ApiFailure catch (failure) {
      if (_disposed) return null;
      final error = toInviteError(failure);
      if (error is InviteRoleUnavailable) {
        // The role list is stale by definition if the server rejected the
        // chosen role — re-fetch so the person is not choosing from it again.
        ref.invalidate(rolesProvider);
      }
      state = InviteState(error: error);
      return null;
    }
  }

  /// Leaving the `INVITATION_PENDING` panel to edit the email again.
  void clearError() {
    if (!_disposed) state = const InviteState();
  }
}

final inviteControllerProvider =
    NotifierProvider.autoDispose<InviteController, InviteState>(InviteController.new);
