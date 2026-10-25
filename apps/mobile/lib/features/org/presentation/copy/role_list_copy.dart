/// T-003-M05 — composes R1's role-row lines from the shared §0.2 helpers
/// (`role_display_copy.dart`), so the list does not re-derive any rule.
library;

import '../../../../core/l10n/l10n.dart';
import '../../domain/entities/role_entities.dart';
import 'role_display_copy.dart';

String roleRowName(AppLocalizations t, RoleDetailView role) => roleDisplayName(
      t,
      roleKey: role.roleKey,
      name: role.name,
      nameCustomized: role.nameCustomized,
    );

/// §0.2 `lastEdited` → the sealed model `roleLastEditedLine` takes. `kind` is
/// an OPEN set: anything unknown keeps its timestamp and loses the "โดย…".
RoleLastEdited? roleLastEditedFrom(AppLocalizations t, RoleLastEditedInfo? info) {
  if (info == null) return null;
  return switch (info.kind) {
    'me' => RoleLastEditedByMe(info.at),
    'member' => RoleLastEditedByMember(
        info.at,
        roleName: info.byRoleName == null
            ? null
            : roleDisplayName(
                t,
                roleKey: info.byRoleKey,
                name: info.byRoleName!,
                nameCustomized: info.byRoleNameCustomized,
              ),
      ),
    'former_member' => RoleLastEditedByFormerMember(info.at),
    _ => RoleLastEditedUnknownKind(info.at),
  };
}

/// Line 2 of a row: "สมาชิก n คน (รวมคุณ)" + " · คำเชิญที่ยังไม่ปิด m ใบ".
String roleRowUsageLine(AppLocalizations t, RoleDetailView role, {required bool isMine}) {
  final usage = roleUsageLine(t, activeMembers: role.usage.activeMembers, isMine: isMine);
  final pending = rolePendingInvitationsSuffix(t, role.usage.pendingInvitations);
  return pending == null ? usage : '$usage$pending';
}
