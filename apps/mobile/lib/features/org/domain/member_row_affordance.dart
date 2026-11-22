/// T-003-M10/M11 ★ — ux R7 (mobile) / R10 (ก): what a member row offers.
///
/// **Verdict present** (viewer holds `manage_members` ∧ `manage_roles`): the
/// server's `viewerCanManage` / `manageBlockedReason` is the whole answer,
/// both ways (test-plan CM3-03) — nothing on this device may move it.
///
/// **Verdict absent** (viewer holds `manage_members` but not `manage_roles`
/// — the server omits it ON PURPOSE, api-spec §3.1; or an older server):
/// NOT fail-closed (review M10 → T-003-M11). The F-002 rule the web W10
/// applies (`memberActionsFor`), from facts the SERVER put on the row:
///  - your own row (`isMe`) → open (D-040: R10 + the R10a confirm);
///  - an Owner row (`isOwner`, decided server-side from capabilities) while
///    the viewer is not an Owner → locked `owner_only`;
///  - any other active row → open, and the server decides on submit (a
///    refusal lands in the sheet, ux R10 (ค)).
/// The client never computes ⊊/⊆ itself, never reads a role key.
///
/// [viewerIsOwner] = the viewer holds `full_access`, as the server told this
/// device (`myMembership.capabilities`). Read only on the absent branch.
///
/// Pure Dart (gate rule 1).
library;

import 'entities/org_entities.dart';

sealed class MemberRowAffordance {
  const MemberRowAffordance();
}

/// The row may open the change-role flow (R10).
final class MemberRowManageable extends MemberRowAffordance {
  const MemberRowManageable();
}

/// Not for this viewer. [reason] is the raw OPEN-set value (null if the
/// server sent none); presentation maps it to copy, unknown → generic.
final class MemberRowLocked extends MemberRowAffordance {
  const MemberRowLocked(this.reason);
  final String? reason;
}

/// Nothing to offer and nothing to explain (a row that is not active).
final class MemberRowNoAction extends MemberRowAffordance {
  const MemberRowNoAction();
}

MemberRowAffordance memberRowAffordance(MemberRow member, {required bool viewerIsOwner}) {
  if (!member.isActive) return const MemberRowNoAction();
  return switch (member.viewerCanManage) {
    true => const MemberRowManageable(),
    false => MemberRowLocked(member.manageBlockedReason),
    null when member.isMe => const MemberRowManageable(),
    null when member.isOwner && !viewerIsOwner => const MemberRowLocked('owner_only'),
    null => const MemberRowManageable(),
  };
}
