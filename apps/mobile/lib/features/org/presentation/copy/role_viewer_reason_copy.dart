/// T-003-M03 — ux-wireframe §0.3 (ก): `RoleDetail.viewer.*` reason → copy.
///
/// `reason` is an OPEN set (api-spec: new reasons can ship without a client
/// update) — every function here has an explicit fallback branch for a value
/// it does not recognize, never a `throw`. See `role_display_copy.dart`'s
/// doc comment for why this lives in `presentation/copy/` rather than
/// `domain/` (a boundary-gate rule, not a purity concession — every function
/// below is still a pure `(AppLocalizations, ...) -> T`).
library;

import '../../../../core/l10n/l10n.dart';

/// A banner with a bold title and a body — §0.3 (ก)'s "หัวข้อ (ตัวหนา)" /
/// "เนื้อความ" columns.
class RoleReasonBanner {
  const RoleReasonBanner({required this.title, required this.body});
  final String title;
  final String body;
}

/// `viewer.canEdit.reason` (R4's single main banner) and, per the ลำดับบนจอ
/// rule, also `viewer.canDelete.reason` when it differs from `canEdit`'s.
/// Never call this with `reason == 'owner_role'` — §0.3 (ก) says that one
/// hides the clone button outright, with no copy; it only ever appears on
/// `canClone`, which is [roleCreateOrCloneBlockedCopy]'s job.
RoleReasonBanner roleEditOrDeleteReasonBanner(AppLocalizations t, String reason) => switch (reason) {
      'writes_disabled' => RoleReasonBanner(title: t.roleReasonWritesDisabledTitle, body: t.roleReasonWritesDisabledBody),
      'role_locked' => RoleReasonBanner(title: t.roleReasonRoleLockedTitle, body: t.roleReasonRoleLockedBody),
      'exceeds_your_permissions' =>
        RoleReasonBanner(title: t.roleReasonExceedsPermissionsTitle, body: t.roleReasonExceedsPermissionsBody),
      'in_use_requires_manage_members' => RoleReasonBanner(
          title: t.roleReasonInUseRequiresManageMembersTitle,
          body: t.roleReasonInUseRequiresManageMembersBody,
        ),
      'equal_permissions_in_use' => RoleReasonBanner(
          title: t.roleReasonEqualPermissionsInUseTitle,
          body: t.roleReasonEqualPermissionsInUseBody,
        ),
      _ => RoleReasonBanner(title: t.roleReasonUnknownTitle, body: t.roleReasonUnknownBody),
    };

/// `viewer.canDelete.reason` when it is one of the two DELETE-only reasons,
/// shown under the "ลบบทบาทนี้" button (R3/R4) rather than as the main
/// banner. Not used for `role_locked` / `exceeds_your_permissions` /
/// `in_use_requires_manage_members` / `equal_permissions_in_use` — those
/// come from [roleEditOrDeleteReasonBanner] and, per §0.3 (ก)'s ordering
/// rule, are hidden here entirely when they match `canEdit.reason` (the
/// main banner already said it).
///
/// [roleUsageLine]/[rolePendingInvitationsSuffix] (§0.2) supply the
/// "สมาชิก {n} คน · คำเชิญที่ยังไม่ปิด {m} ใบ" line this banner's body is
/// meant to follow for `in_use` — composing that join is the caller's job
/// (it needs `usage`, which this function does not take).
RoleReasonBanner roleDeleteOnlyReasonBanner(AppLocalizations t, String reason) => switch (reason) {
      'in_use' => RoleReasonBanner(title: t.roleDeleteInUseTitle, body: t.roleDeleteInUseBody),
      'history_limit_reached' =>
        RoleReasonBanner(title: t.roleDeleteHistoryLimitReachedTitle, body: t.roleDeleteHistoryLimitReachedBody),
      _ => RoleReasonBanner(title: t.roleReasonUnknownTitle, body: t.roleReasonUnknownBody),
    };

/// `viewer.canCreate.reason` (R1's "สร้างบทบาท" button) / `viewer.canClone.reason`
/// (R3/R4's "ทำสำเนาเป็นบทบาทใหม่" button) — both only ever disable for
/// `role_limit_reached`; every other `canClone` reason (`role_locked`,
/// `exceeds_your_permissions`, `in_use_requires_manage_members`,
/// `equal_permissions_in_use`) is covered by the main banner and hides the
/// button instead per §0.3 (ก)'s ordering table, so it never reaches here.
///
/// [limit] is `viewer.limit` if the caller has it in hand (R1 always does);
/// `null` when it does not (e.g. R4 opened directly without R1's payload) —
/// §0.3 (ก) has separate copy for that, never a made-up number.
///
/// `owner_role` (canClone only) is deliberately NOT handled — that reason
/// hides the button with no copy at all (AC-3.2); calling this with it is a
/// caller bug, not a runtime case, so it falls into the unknown-reason copy
/// rather than crashing.
String roleCreateOrCloneBlockedCopy(AppLocalizations t, String reason, {int? limit}) => switch (reason) {
      'role_limit_reached' =>
        limit != null ? t.roleLimitReachedWithLimitBody(limit) : t.roleLimitReachedUnknownLimitBody,
      _ => t.roleReasonUnknownBody,
    };
