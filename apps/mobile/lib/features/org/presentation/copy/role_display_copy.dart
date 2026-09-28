/// T-003-M03 — ux-wireframe §0.2 "กติกาการแสดงผลกลาง": the rules that decide
/// what a role's name/usage/last-edited LINE reads, shared by every screen
/// that renders a role (R1, R3, R4, R5(ข), R6, R8 …) so none of them has to
/// re-derive the same null-checks and get them slightly different.
///
/// Lives in `presentation/copy/`, not `domain/`, for the same reason
/// `presentation/widgets/role_label.dart` does: [AppLocalizations] is the
/// generated gen_l10n class, which transitively pulls in `flutter` — the
/// boundary gate (`tool/check_boundaries.dart` rule 1) forbids that inside
/// `domain/`. Every function here is still a pure `(AppLocalizations, ...) ->
/// String` with no `BuildContext` and no side effect, so it is exactly as
/// unit-testable as if it lived in `domain/`.
library;

import '../../../../core/l10n/l10n.dart';
import '../../domain/expiry.dart' show formatShopDateTime;
import '../widgets/role_label.dart';

/// ux §0.2 "ชื่อบทบาท" row.
///
/// `nameCustomized` is `true` → the shop typed this name, show it verbatim.
/// `false` OR **absent** (older server — the field is new) → the same rule:
/// translate by `roleKey`, falling back to [name] for anything [roleLabel]
/// doesn't recognize (an unknown/custom `roleKey`, or `roleKey == null`).
String roleDisplayName(
  AppLocalizations t, {
  required String? roleKey,
  required String name,
  bool? nameCustomized,
}) {
  if (nameCustomized == true) return name;
  return roleLabel(t, roleKey, name);
}

/// ux §0.2 "ใช้อยู่" row — e.g. "สมาชิก 2 คน (รวมคุณ)" or "ยังไม่มีสมาชิกใช้".
///
/// [isMine] is `myMembership.roleId === role.id` — only ever appended when
/// there IS at least one active member (a role with 0 members can't be the
/// viewer's own).
String roleUsageLine(AppLocalizations t, {required int activeMembers, required bool isMine}) {
  if (activeMembers == 0) return t.roleUsageEmpty;
  final base = t.roleUsageCount(activeMembers);
  return isMine ? '$base${t.roleUsageIncludesYou}' : base;
}

/// ux §0.2 "คำเชิญค้าง" row — appended after [roleUsageLine], or `null` when
/// there is nothing to say (`pendingInvitations == 0`, including negative
/// values from a malformed payload — never printed as "-1 ใบ").
String? rolePendingInvitationsSuffix(AppLocalizations t, int pendingInvitations) {
  if (pendingInvitations <= 0) return null;
  return t.rolePendingInvitationsSuffix(pendingInvitations);
}

/// ux §0.2 "แก้ไขล่าสุด" (AC-9.6) — who last edited a role, modelled as the
/// server actually sends it: either there IS no edit yet ([RoleLastEdited]
/// absent entirely → [roleLastEditedLine] called with `null`), or there is
/// one, tagged with a `kind` that is an OPEN set (only `me`/`member`/
/// `former_member` are defined today).
sealed class RoleLastEdited {
  const RoleLastEdited();
}

/// `lastEdited.kind == 'me'`.
class RoleLastEditedByMe extends RoleLastEdited {
  const RoleLastEditedByMe(this.at);
  final DateTime at;
}

/// `lastEdited.kind == 'member'` — a still-active member of some role.
/// [roleName] is that role's display name (already resolved via
/// [roleDisplayName] by the caller) and may be absent from an incomplete
/// payload, which falls back to the unknown-kind copy (§0.2: "ไม่มี
/// `roleName`" is explicitly grouped with unknown `kind`).
class RoleLastEditedByMember extends RoleLastEdited {
  const RoleLastEditedByMember(this.at, {this.roleName});
  final DateTime at;
  final String? roleName;
}

/// `lastEdited.kind == 'former_member'` — edited by someone no longer in
/// the shop.
class RoleLastEditedByFormerMember extends RoleLastEdited {
  const RoleLastEditedByFormerMember(this.at);
  final DateTime at;
}

/// Any `kind` this build does not recognize, still carrying `at` — §0.2
/// says drop the "โดย…" clause rather than print the raw key, not drop the
/// whole line.
class RoleLastEditedUnknownKind extends RoleLastEdited {
  const RoleLastEditedUnknownKind(this.at);
  final DateTime at;
}

/// [lastEdited] is `null` for `RoleDetail.lastEdited == null` (still the
/// system default, never edited) — the ONE case with no timestamp at all.
String roleLastEditedLine(AppLocalizations t, RoleLastEdited? lastEdited) {
  return switch (lastEdited) {
    null => t.roleLastEditedDefault,
    RoleLastEditedByMe(:final at) => t.roleLastEditedByMe(formatShopDateTime(at)),
    RoleLastEditedByMember(:final at, roleName: final roleName?) =>
      t.roleLastEditedByMember(roleName, formatShopDateTime(at)),
    RoleLastEditedByMember(:final at) => t.roleLastEditedUnknown(formatShopDateTime(at)),
    RoleLastEditedByFormerMember(:final at) => t.roleLastEditedByFormerMember(formatShopDateTime(at)),
    RoleLastEditedUnknownKind(:final at) => t.roleLastEditedUnknown(formatShopDateTime(at)),
  };
}
