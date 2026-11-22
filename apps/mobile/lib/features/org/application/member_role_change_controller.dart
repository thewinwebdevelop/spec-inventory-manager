import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/api_failure.dart';
import '../../../core/session/capabilities.dart';
import '../../../core/session/session_controller.dart';
import '../../../core/session/session_failure_listener.dart';
import '../domain/entities/org_entities.dart';
import 'member_role_change_error.dart';
import 'org_providers.dart';

/// The outcome of one confirmed press of R10's "บันทึกบทบาท".
sealed class MemberRoleChangeResult {
  const MemberRoleChangeResult();
}

class MemberRoleChanged extends MemberRoleChangeResult {
  const MemberRoleChanged(this.row, {required this.stillManagesMembers});

  /// The `200` row — the screen renders it before its re-read lands.
  final MemberRow row;

  /// `false` only after changing YOUR OWN role to one without
  /// `manage_members` (re-learned from the server, never guessed): the
  /// members screen is no longer yours to stay on (ux R10a).
  final bool stillManagesMembers;
}

class MemberRoleChangeRefused extends MemberRoleChangeResult {
  const MemberRoleChangeRefused(this.error, {this.stillManagesMembers = true});

  final MemberRoleChangeError error;

  /// Re-learned for `403 FORBIDDEN` before the copy is chosen (ux R10 (ค)).
  final bool stillManagesMembers;
}

/// The session listener took the failure (`401`, `ORG_ACCESS_DENIED`): the
/// app is about to move; the sheet must not paint an error under it.
class MemberRoleChangeTakenBySession extends MemberRoleChangeResult {
  const MemberRoleChangeTakenBySession();
}

/// T-003-M11 ★ — R10's submit: `PATCH /orgs/{orgId}/members/{userId}`
/// `{roleId}`. State = "a write is in flight" (the sheet locks while it is).
///
/// Pessimistic, ONE request per press, nothing retried. The no-op guard is
/// the sheet's (it never calls this with the current role) AND repeated here,
/// because a no-op on the server still writes a `role_changed` event (SR-19).
///
/// Re-reads it owns (shop-level): `GET /roles` when the table says so,
/// R1's `role-details` after a success (usage counts moved), and
/// `myMembership` after changing your own role or on `403 FORBIDDEN`. The
/// members LIST is the screen's to re-read — it owns which list it shows.
class MemberRoleChangeController extends AutoDisposeNotifier<bool> {
  bool _disposed = false;

  @override
  bool build() {
    ref.onDispose(() => _disposed = true);
    return false;
  }

  /// `null` = ignored (a write is already in flight, or [roleId] is the
  /// target's current role).
  Future<MemberRoleChangeResult?> submit({required MemberRow target, required String roleId}) async {
    if (state || roleId == target.roleId) return null;
    state = true;
    try {
      final row = await ref
          .read(orgScopedRepositoryProvider)
          .updateMemberRole(userId: target.userId, roleId: roleId);
      ref.invalidate(roleDetailsProvider);
      final still = target.isMe ? await _relearnStillManagesMembers() : true;
      if (!_disposed) state = false;
      return MemberRoleChanged(row, stillManagesMembers: still);
    } on ApiFailure catch (failure) {
      if (ref.read(sessionFailureListenerProvider).handle(failure)) {
        if (!_disposed) state = false;
        return const MemberRoleChangeTakenBySession();
      }
      final error = toMemberRoleChangeError(failure);
      if (error.refetchRoles) ref.invalidate(rolesProvider);
      final still = error.relearnMembership ? await _relearnStillManagesMembers() : true;
      if (!_disposed) state = false;
      return MemberRoleChangeRefused(error, stillManagesMembers: still);
    }
  }

  /// Asks the server what this member may do now, then answers from the
  /// session it updated. A failed lookup leaves the session as it was — the
  /// screens then offer what they offered, and the server refuses regardless.
  Future<bool> _relearnStillManagesMembers() async {
    ref.invalidate(orgProfileProvider);
    await learnCapabilitiesFromRef(ref);
    return ref.read(activeOrgProvider)?.can(manageMembersCapability) ?? false;
  }
}

final memberRoleChangeControllerProvider =
    AutoDisposeNotifierProvider<MemberRoleChangeController, bool>(MemberRoleChangeController.new);
