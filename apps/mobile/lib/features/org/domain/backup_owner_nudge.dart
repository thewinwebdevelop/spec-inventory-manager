import 'entities/org_entities.dart';

/// T-002-M3 — the backup-owner nudge (D-030, ux-wireframe §7), as a pure
/// decision.
///
/// Why it exists at all: since D-030 nobody in the shop can reset an Owner's
/// password — not even an Admin — and this version has no self-service email
/// reset. A shop with one Owner cannot recover itself. The banner is
/// preventive advice, tone `info`, and ux forbids the words
/// "อันตราย/เสี่ยง/ข้อมูลจะหาย".
///
/// Three conditions, and each one is a way of NOT saying something untrue:
///
///  1. the list is complete — counting Owners in the first 25 of 60 members
///     and warning on the result is stating a fact you do not have;
///  2. exactly one active Owner;
///  3. that Owner is me — if somebody else is the sole Owner, this is not my
///     warning to act on, and I may not be able to act on it at all.
///
/// ⚠️ Deviation from ux-wireframe §7, deliberate: ux specifies counting
/// `roleKey === "owner"` and suppressing the banner when any `roleKey` is
/// null (an F-003 custom role, "นับไม่ได้ → ไม่แสดง"). This counts
/// [MemberRow.isOwner] instead, which the server computes from CAPABILITIES
/// (api-spec §3.7) — the project's rule is that ownership is decided by
/// `full_access` and never by a role name or key. The intent of ux's caveat
/// is "do not warn on a count you cannot trust"; `isOwner` is a count that
/// can be trusted, including for the custom roles the caveat was written to
/// protect against. The visible difference: a shop whose second Owner holds a
/// custom `full_access` role gets no banner here (correct — it has two
/// Owners), where the keyed rule would also show none (by accident). Flagged
/// for `ux` to confirm rather than changed quietly.
/// [complete] is the caller's answer to "have I loaded everybody?" — the
/// screen knows it (no `nextCursor`, nothing in flight, no failed page),
/// and passing it in keeps this function free of the paging state's shape.
bool shouldShowBackupOwnerNudge({
  required List<MemberRow> members,
  required bool complete,
}) {
  if (!complete) return false;

  final owners = members.where((m) => m.isActive && m.isOwner).toList(growable: false);
  return owners.length == 1 && owners.single.isMe;
}
