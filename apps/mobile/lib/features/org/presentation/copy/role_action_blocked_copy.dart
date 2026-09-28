/// T-003-M03 — ux-wireframe §0.3 (ข): the three "why can't I do this to this
/// row" reason fields, each an OPEN set with its own unknown-value fallback
/// (never a raw key, never a throw). Shared by every screen that renders a
/// member/invitation/role-assignment row (R6, R7, R8, and R10's row/sheet —
/// R10's OWN copy is out of T-003-M03's scope, but this reused reason text
/// is not).
///
/// See `role_display_copy.dart`'s doc comment for why this lives in
/// `presentation/copy/` rather than `domain/`.
library;

import '../../../../core/l10n/l10n.dart';

/// `RoleRow.assignBlockedReason` (R8/R10 — "why can't I offer this role to
/// someone else").
String roleAssignBlockedCopy(AppLocalizations t, String reason) => switch (reason) {
      'owner_only' => t.roleAssignBlockedOwnerOnly,
      'exceeds_your_permissions' => t.roleAssignBlockedExceedsPermissions,
      _ => t.roleAssignBlockedUnknown,
    };

/// `MemberRow.manageBlockedReason` (R6/R7/R10 — "why can't I change this
/// member's role / remove them").
String memberManageBlockedCopy(AppLocalizations t, String reason) => switch (reason) {
      'owner_only' => t.memberManageBlockedOwnerOnly,
      'equal_permissions' => t.memberManageBlockedEqualPermissions,
      'exceeds_your_permissions' => t.memberManageBlockedExceedsPermissions,
      _ => t.memberManageBlockedUnknown,
    };

/// `Invitation.manageBlockedReason` (R6/R7 — "why can't I cancel/reissue this
/// invitation"). Web-only today (R7 has no mobile invitation actions per
/// D-035/F-002b), kept here anyway since the reason set is identical to the
/// other two and belongs with them, not duplicated later.
String invitationManageBlockedCopy(AppLocalizations t, String reason) => switch (reason) {
      'owner_only' => t.invitationManageBlockedOwnerOnly,
      'exceeds_your_permissions' => t.invitationManageBlockedExceedsPermissions,
      _ => t.invitationManageBlockedUnknown,
    };
