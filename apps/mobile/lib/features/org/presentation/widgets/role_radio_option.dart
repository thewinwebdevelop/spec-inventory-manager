import 'package:flutter/material.dart';

import '../../../../core/l10n/l10n.dart';
import '../../domain/entities/org_entities.dart';
import '../../domain/role_assignability.dart';
import '../copy/role_action_blocked_copy.dart';
import '../copy/role_display_copy.dart';

/// ux R8 — one role option, shared by the invite screen and the R10
/// change-role sheet (test-plan CM3-08: "ชุดเดียวกับจอเชิญ — widget/แหล่ง
/// ข้อมูลเดียวกัน"). Must sit inside a `RadioGroup<String>` keyed by role id.
///
/// Disabled + reason, never hidden: an option the server says the viewer
/// cannot hand out stays in the list with the sentence that explains it.
class RoleRadioOption extends StatelessWidget {
  const RoleRadioOption({
    super.key,
    required this.roleId,
    required this.label,
    required this.disabled,
    this.reason,
    this.description,
    this.isCurrent = false,
    this.locked = false,
  });

  /// Builds the option from the server's row with the shared R8 rule
  /// ([roleOptionDisabled]) — the only constructor the two screens use.
  factory RoleRadioOption.fromRole(
    AppLocalizations t,
    RoleRow role, {
    required bool viewerIsOwner,
    String? description,
    bool isCurrent = false,
    bool locked = false,
  }) {
    final disabled = roleOptionDisabled(role, viewerIsOwner: viewerIsOwner);
    return RoleRadioOption(
      key: ValueKey('role-option-${role.id}'),
      roleId: role.id,
      label: roleDisplayName(t, roleKey: role.key, name: role.name, nameCustomized: role.nameCustomized),
      disabled: disabled,
      reason: disabled ? roleAssignBlockedCopy(t, roleOptionBlockedReason(role)) : null,
      // The caller's: only the invite screen shows one (the Owner sentence);
      // the R10 sheet shows none, to stay short (ux R8 mobile note).
      description: description,
      isCurrent: isCurrent,
      locked: locked,
    );
  }

  final String roleId;

  /// The display name (ux §0.2) — without the "(บทบาทปัจจุบัน)" suffix.
  final String label;

  /// The R8 verdict: the viewer may not hand this role out.
  final bool disabled;
  final String? reason;
  final String? description;

  /// The target member's current role (R10) — marked, and selectable even
  /// when [disabled] (it is the starting value, not a choice being made).
  final bool isCurrent;

  /// The whole list is held (R10 while sending / after TARGET_NOT_BELOW_ACTOR).
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return RadioListTile<String>(
      value: roleId,
      enabled: !disabled && !locked,
      title: Text(isCurrent ? t.memberRoleCurrentSuffix(label) : label),
      subtitle: (description == null && reason == null)
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (description != null) Text(description!),
                if (reason != null) Text(reason!),
              ],
            ),
      contentPadding: EdgeInsets.zero,
    );
  }
}
