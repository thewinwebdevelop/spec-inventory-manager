/// T-003-M08 — the ux §E copy for a refused role write, shared by R3's save
/// (M06) and R5's delete so the two cannot drift. Only the generic sentence
/// differs: "บันทึกบทบาทไม่สำเร็จ…" vs "ลบบทบาทไม่สำเร็จ…" ([deleting]).
///
/// Plus R5 (ข)'s count line (§0.2 with the zero parts dropped).
library;

import '../../../../core/l10n/l10n.dart';
import '../../application/role_write_error.dart';
import '../../domain/entities/role_entities.dart';
import 'role_display_copy.dart';

String roleBannerProblemCopy(
  AppLocalizations t,
  RoleBannerProblem problem, {
  int? limit,
  bool deleting = false,
}) =>
    switch (problem) {
      RoleBannerProblem.unknownCapability => t.roleFormErrorUnknownCapability,
      RoleBannerProblem.fullAccessReserved => t.roleFormErrorFullAccessReserved,
      RoleBannerProblem.roleLimitReached =>
        limit != null ? t.roleLimitReachedWithLimitBody(limit) : t.roleLimitReachedUnknownLimitBody,
      RoleBannerProblem.roleLocked => t.roleReasonRoleLockedBody,
      RoleBannerProblem.exceedsActor => t.roleFormErrorExceedsActor,
      RoleBannerProblem.targetNotBelowActor => t.roleReasonEqualPermissionsInUseBody,
      RoleBannerProblem.heldRequiresManageMembers => t.roleReasonInUseRequiresManageMembersBody,
      RoleBannerProblem.writesDisabled => t.roleReasonWritesDisabledBody,
      RoleBannerProblem.busy => t.roleFormErrorBusy,
      RoleBannerProblem.generic => deleting ? t.roleFormErrorGenericDelete : t.roleFormErrorGeneric,
    };

/// R5 (ข): "สมาชิก {n} คน[ (รวมคุณ)] · คำเชิญที่ยังไม่ปิด {m} ใบ" — each part
/// only when it is > 0; `''` when both are 0.
String roleInUseCountLine(AppLocalizations t, RoleUsage usage, {required bool isMine}) {
  final parts = <String>[
    if (usage.activeMembers > 0) roleUsageLine(t, activeMembers: usage.activeMembers, isMine: isMine),
    if (usage.pendingInvitations > 0) t.roleDeleteInUseInvitationsCount(usage.pendingInvitations),
  ];
  return parts.join(' · ');
}
