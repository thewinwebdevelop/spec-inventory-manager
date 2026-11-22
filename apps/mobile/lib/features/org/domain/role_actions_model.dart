/// T-003-M08 — what R3/R4's clone and delete controls do. The Dart twin of
/// web `role-actions-model.ts` (W08/W09); same rules, same cases.
///
/// Pure, and decided ONLY from the server: the `viewer.*` verdicts (reasons in
/// the server's fixed order — api-spec §3) and `isSystem` (the Owner role).
/// ⛔ Never from the viewer's local capabilities (repo lesson "client-invented
/// server facts"); the server still refuses whatever this shows.
///
/// ux-wireframe §0.3 (ก) "ลำดับบนจอ R4":
///  - `canEdit.reason` is the ONE main banner;
///  - `canDelete.reason` shows under the delete button ONLY when it differs
///    from `canEdit.reason` — equal ⇒ the button is hidden (never said twice);
///  - `canClone`: allowed → button · `role_limit_reached` → disabled + reason ·
///    any other reason → hidden (the main banner covers it).
/// ux R4 table: `writes_disabled` → clone and delete DISABLED (the single top
/// banner explains) · the Owner shows neither (AC-3.2).
///
/// Reasons are carried RAW (an open set); presentation maps them to copy, with
/// a generic fallback for anything unknown.
library;

import 'entities/role_entities.dart';

const String _writesDisabled = 'writes_disabled';
const String _roleLimitReached = 'role_limit_reached';
const String _inUse = 'in_use';

/// Where a disabled clone button sits on R4.
enum ClonePlace {
  /// Inside the reason banner (the nearest way forward — AC-5.2).
  banner,

  /// Under "การจัดการอื่น" (`writes_disabled`: the top banner explains).
  section,
}

sealed class CloneAffordance {
  const CloneAffordance();
}

class CloneHidden extends CloneAffordance {
  const CloneHidden();
}

/// Enabled, inside the R4 reason banner.
class CloneInBanner extends CloneAffordance {
  const CloneInBanner();
}

class CloneDisabled extends CloneAffordance {
  const CloneDisabled({required this.place, this.reason});

  final ClonePlace place;

  /// The reason to print under it (`role_limit_reached`), or `null` when the
  /// top banner already explains (`writes_disabled`).
  final String? reason;
}

/// R4 only — R3 keeps its own clone control in "การจัดการอื่น" (M06).
CloneAffordance cloneAffordance({required RoleVerdict canClone, required bool isSystem}) {
  if (isSystem) return const CloneHidden();
  if (canClone.allowed) return const CloneInBanner();
  return switch (canClone.reason) {
    _writesDisabled => const CloneDisabled(place: ClonePlace.section),
    // R4 is opened without R1's `limit` in hand — the no-number sentence.
    _roleLimitReached => const CloneDisabled(place: ClonePlace.banner, reason: _roleLimitReached),
    _ => const CloneHidden(),
  };
}

sealed class DeleteAffordance {
  const DeleteAffordance();
}

class DeleteHidden extends DeleteAffordance {
  const DeleteHidden();
}

class DeleteEnabled extends DeleteAffordance {
  const DeleteEnabled();
}

/// Disabled with no note of its own (`writes_disabled`).
class DeleteDisabled extends DeleteAffordance {
  const DeleteDisabled();
}

/// Disabled + the R5 (ข) panel under it, numbers from `usage`.
class DeleteInUse extends DeleteAffordance {
  const DeleteInUse();
}

/// Disabled + the reason's own title/body (`history_limit_reached`, or an
/// unknown reason → generic copy). `''` = the server gave no reason at all.
class DeleteBlocked extends DeleteAffordance {
  const DeleteBlocked(this.reason);

  final String reason;
}

/// R3 and R4. On R3 `canEdit` is allowed, so its reason never "equals".
DeleteAffordance deleteAffordance({
  required RoleVerdict canEdit,
  required RoleVerdict canDelete,
  required bool isSystem,
}) {
  if (isSystem) return const DeleteHidden();
  if (canDelete.allowed) return const DeleteEnabled();
  final reason = canDelete.reason;
  if (reason == _writesDisabled) return const DeleteDisabled();
  final editReason = canEdit.allowed ? null : canEdit.reason;
  if (editReason != null && reason == editReason) return const DeleteHidden();
  if (reason == _inUse) return const DeleteInUse();
  return DeleteBlocked(reason ?? '');
}

/// R5 (ข): the only holder is the viewer themself — "ให้เจ้าของร้านย้ายคุณ…"
/// replaces the generic instruction.
bool inUseOnlyMe(RoleUsage usage, {required bool isMine}) =>
    isMine && usage.activeMembers == 1 && usage.pendingInvitations == 0;
