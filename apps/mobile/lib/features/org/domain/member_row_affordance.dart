/// T-003-M10 ★ — ux R7 (mobile) / R10 (ก): what a member row offers.
///
/// Decided ONLY from the server's verdict (`viewerCanManage` /
/// `manageBlockedReason`, api-spec §3.1). No role key, no capability set, no
/// `isOwner` — a client that recomputes authority invents server facts
/// (test-plan CM3-03: the verdict beats whatever this device holds, both
/// ways). Pure Dart (gate rule 1).
///
/// Verdict ABSENT (viewer lacks `manage_roles`, or an older server) → no
/// action: mobile F-002 had no per-member actions, so "F-002 behaviour" here
/// is "not offered".
library;

import 'entities/org_entities.dart';

sealed class MemberRowAffordance {
  const MemberRowAffordance();
}

/// Server said yes — the row may open the change-role flow (R10).
final class MemberRowManageable extends MemberRowAffordance {
  const MemberRowManageable();
}

/// Server said no. [reason] is the raw OPEN-set value (null if the server
/// sent none); presentation maps it to copy, unknown → generic.
final class MemberRowLocked extends MemberRowAffordance {
  const MemberRowLocked(this.reason);
  final String? reason;
}

/// Nothing to offer and nothing to explain (not active, or no verdict).
final class MemberRowNoAction extends MemberRowAffordance {
  const MemberRowNoAction();
}

MemberRowAffordance memberRowAffordance(MemberRow member) {
  if (!member.isActive) return const MemberRowNoAction();
  return switch (member.viewerCanManage) {
    true => const MemberRowManageable(),
    false => MemberRowLocked(member.manageBlockedReason),
    null => const MemberRowNoAction(),
  };
}
