import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/session/session_state.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/labeled_text_field.dart';
import '../../application/invite_controller.dart';
import '../../application/invite_error.dart';
import '../../application/org_providers.dart';
import '../../domain/entities/org_entities.dart';
import '../widgets/expiry_text.dart';
import '../widgets/role_label.dart';
import 'invite_link_screen.dart';

/// S7 — เชิญสมาชิก, mobile (ux-wireframe §8 + §13: full screen, so the
/// keyboard does not fight the form).
///
/// Two rules from ux worth stating out loud, because both are the kind that
/// look like polish and are not:
///
///  - the role defaults to the LOWEST one available, never to the last used
///    or the first returned. The safest default is the one that grants least;
///  - the "เจ้าของร้าน" option is shown but DISABLED for a non-Owner, with the
///    reason next to it. Hiding it would leave an Admin wondering why the
///    thing they were told to do is not there.
class InviteMemberScreen extends ConsumerStatefulWidget {
  const InviteMemberScreen({super.key, this.initialRoleKey});

  /// Pre-selects a role — the backup-owner nudge opens this screen with
  /// `owner` already chosen (ux-wireframe §7).
  final String? initialRoleKey;

  @override
  ConsumerState<InviteMemberScreen> createState() => _InviteMemberScreenState();
}

class _InviteMemberScreenState extends ConsumerState<InviteMemberScreen> {
  final _email = TextEditingController();
  final _emailFocus = FocusNode();
  String? _roleId;

  @override
  void dispose() {
    _email.dispose();
    _emailFocus.dispose();
    super.dispose();
  }

  bool get _iAmOwner =>
      ref.read(activeOrgProvider)?.capabilities.contains(fullAccessCapability) ?? false;

  /// The default selection, once the roles arrive: the lowest role on offer.
  void _seedRole(List<RoleRow> roles) {
    if (_roleId != null || roles.isEmpty) return;
    final preset = widget.initialRoleKey;
    final match = preset == null ? null : roles.where((r) => r.key == preset).firstOrNull;
    final staff = roles.where((r) => r.key == 'staff').firstOrNull;
    // `staff` by key when it exists; otherwise the last row, which the
    // contract orders least-privileged last. Never `roles.first` — that is
    // the Owner row.
    _roleId = (match ?? staff ?? roles.last).id;
  }

  Future<void> _submit() async {
    final issued = await ref
        .read(inviteControllerProvider.notifier)
        .submit(rawEmail: _email.text, roleId: _roleId);
    if (!mounted) return;

    if (issued == null) {
      if (ref.read(inviteControllerProvider).error is InviteFieldError) {
        _emailFocus.requestFocus();
      }
      return;
    }
    // Straight into S8, replacing this screen: going "back" to a filled-in
    // invite form after the link exists would invite a second invitation for
    // the same person.
    await Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => InviteLinkScreen(invite: issued)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final state = ref.watch(inviteControllerProvider);
    final roles = ref.watch(rolesProvider);
    final error = state.error;

    if (error is InvitePending) {
      return Scaffold(
        appBar: AppBar(title: Text(t.inviteTitle)),
        body: _PendingPanel(
          error: error,
          onBack: () => ref.read(inviteControllerProvider.notifier).clearError(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(t.inviteTitle)),
      body: SafeArea(
        child: roles.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => Padding(
            padding: const EdgeInsets.all(AppSpacing.s6),
            child: ErrorBanner(
              message: t.inviteRolesLoadError,
              onRetry: () => ref.invalidate(rolesProvider),
            ),
          ),
          data: (items) {
            _seedRole(items);
            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.s6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (error is InviteBannerError)
                    ErrorBanner(
                      message: switch (error.banner) {
                        InviteBanner.limitReached => t.inviteErrorLimitReached,
                        InviteBanner.forbidden => t.inviteErrorForbidden,
                        InviteBanner.generic => t.inviteErrorGeneric,
                      },
                      onRetry: error.retry ? _submit : null,
                    ),
                  if (error is InviteThrottled) ErrorBanner(message: t.inviteErrorThrottled),
                  if (error is InviteRoleUnavailable)
                    ErrorBanner(message: t.inviteErrorRoleUnavailable),
                  LabeledTextField(
                    label: t.inviteEmailLabel,
                    controller: _email,
                    placeholder: t.inviteEmailPlaceholder,
                    keyboardType: TextInputType.emailAddress,
                    enabled: !state.submitting,
                    autofocus: true,
                    errorText: error is InviteFieldError
                        ? switch (error.problem) {
                            InviteFieldProblem.emailInvalid =>
                              error.serverMessage ?? t.inviteErrorEmailInvalid,
                            InviteFieldProblem.alreadyMember => t.inviteErrorAlreadyMember,
                          }
                        : null,
                  ),
                  const SizedBox(height: AppSpacing.s6),
                  Text(t.inviteRoleLabel, style: Theme.of(context).textTheme.labelSmall),
                  // One group, one selected value — `RadioGroup` is the
                  // non-deprecated way to say that on this SDK, and it keeps
                  // arrow-key movement inside the group (§14's focus order).
                  RadioGroup<String>(
                    groupValue: _roleId,
                    onChanged: (id) => setState(() => _roleId = id),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final role in items)
                          _RoleOption(
                            role: role,
                            // D-028/C-1: only an Owner can create another
                            // Owner. Disabled and explained, not hidden.
                            disabled: role.key == 'owner' && !_iAmOwner,
                          ),
                      ],
                    ),
                  ),
                  if (items.any((r) => r.key == 'owner') && !_iAmOwner)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.s2),
                      child: Text(
                        t.inviteOwnerDisabledHelper,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  if (_isElevated(items)) ...[
                    const SizedBox(height: AppSpacing.s4),
                    // No number in this sentence, on purpose: the real TTL
                    // arrives with the link's `expiresAt` and nowhere else
                    // (ux Q14).
                    _Note(icon: Icons.hourglass_bottom, text: t.inviteShortTtlNote),
                  ],
                  const SizedBox(height: AppSpacing.s4),
                  // D-012 — sets the expectation BEFORE the button: no email
                  // is sent, the link is yours to pass on.
                  _Note(icon: Icons.info_outline, text: t.inviteNoEmailNote),
                  const SizedBox(height: AppSpacing.s6),
                  ElevatedButton(
                    onPressed: state.submitting || _roleId == null ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                    ),
                    child: Text(state.submitting ? t.inviteSubmitting : t.inviteSubmit),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  bool _isElevated(List<RoleRow> roles) {
    final selected = roles.where((r) => r.id == _roleId).firstOrNull;
    return selected?.key == 'owner' || selected?.key == 'admin';
  }
}

class _RoleOption extends StatelessWidget {
  const _RoleOption({required this.role, required this.disabled});

  final RoleRow role;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final description = switch (role.key) {
      'owner' => t.inviteRoleOwnerDesc,
      'admin' => t.inviteRoleAdminDesc,
      'staff' => t.inviteRoleStaffDesc,
      // An F-003 custom role has no ux-written description. Better an honest
      // blank than a sentence invented about what it can do.
      _ => null,
    };

    return RadioListTile<String>(
      value: role.id,
      enabled: !disabled,
      title: Text(roleLabel(t, role.key, role.name)),
      subtitle: description == null ? null : Text(description),
      contentPadding: EdgeInsets.zero,
    );
  }
}

/// `409 INVITATION_PENDING` — the panel that keeps the person moving (D-027).
///
/// It reports what the server told us about the existing invitation and no
/// more. The two actions ux wants here — "ออกลิงก์ใหม่" and "ยกเลิกคำเชิญเดิม"
/// — need `POST …/invitations/{id}/link` and `DELETE …/invitations/{id}`,
/// which this round does not wire; the way out offered instead is the honest
/// one, back to the email field. Recorded as a debt rather than drawn as
/// buttons that do nothing.
class _PendingPanel extends StatelessWidget {
  const _PendingPanel({required this.error, required this.onBack});

  final InvitePending error;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.s6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.inviteErrorPendingTitle, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s3),
          if (error.roleName != null) Text(t.inviteErrorPendingBody(error.roleName!)),
          if (error.expiresAt != null) Text(formatExpiryLine(t, error.expiresAt!)),
          const SizedBox(height: AppSpacing.s6),
          OutlinedButton(onPressed: onBack, child: Text(t.inviteErrorPendingBack)),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: colors.textMuted),
        const SizedBox(width: AppSpacing.s2),
        Expanded(
          child: Text(text, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
        ),
      ],
    );
  }
}
