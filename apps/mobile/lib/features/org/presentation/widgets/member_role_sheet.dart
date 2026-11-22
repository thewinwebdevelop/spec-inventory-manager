import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/capability_gate.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/confirm_dialog.dart';
import '../../../../core/ui/error_banner.dart';
import '../../application/member_role_change_controller.dart';
import '../../application/member_role_change_error.dart';
import '../../application/org_providers.dart';
import '../../domain/entities/org_entities.dart';
import '../copy/role_display_copy.dart';
import '../screens/roles_screen.dart';
import 'role_radio_option.dart';
import 'role_screen_parts.dart';

/// What the members list should do after the sheet closed or refused.
///
/// [updated] = the `200` row to paint immediately (null = nothing new to
/// paint, just re-read). Called for a success AND for every refusal whose
/// row in ux R10 (ค) says "refetch members".
typedef MembersStale = void Function(MemberRow? updated);

/// T-003-M11 ★ — ux R10 (ข): change ONE member's role, mobile.
///
/// Opened only from a row whose affordance is `MemberRowManageable` — a
/// locked row has no tap handler at all, so there is no path here from it.
///
/// After [member] lost `manage_members` (own role changed, or a `403
/// FORBIDDEN` re-learn), [onLostManageMembers] runs once the sheet is gone —
/// the caller leaves the members screen for "ข้อมูลร้าน" (ux R10a).
Future<void> showMemberRoleSheet(
  BuildContext context, {
  required MemberRow member,
  required MembersStale onMembersStale,
  VoidCallback? onLostManageMembers,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: context.appColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
    ),
    builder: (_) => MemberRoleSheet(
      member: member,
      onMembersStale: onMembersStale,
      onLostManageMembers: onLostManageMembers,
    ),
  );
}

class MemberRoleSheet extends ConsumerStatefulWidget {
  const MemberRoleSheet({
    super.key,
    required this.member,
    required this.onMembersStale,
    this.onLostManageMembers,
  });

  final MemberRow member;
  final MembersStale onMembersStale;
  final VoidCallback? onLostManageMembers;

  @override
  ConsumerState<MemberRoleSheet> createState() => _MemberRoleSheetState();
}

class _MemberRoleSheetState extends ConsumerState<MemberRoleSheet> {
  late String _selected = widget.member.roleId;
  MemberRoleChangeError? _error;

  /// `TARGET_NOT_BELOW_ACTOR`: nothing left to choose; the button says "ปิด".
  bool _locked = false;
  int _throttleLeft = 0;
  Timer? _throttleTimer;

  @override
  void dispose() {
    _throttleTimer?.cancel();
    super.dispose();
  }

  bool get _iAmOwner => ref.read(activeOrgProvider)?.isOwner ?? false;

  void _startThrottle(int seconds) {
    _throttleTimer?.cancel();
    setState(() => _throttleLeft = seconds);
    _throttleTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _throttleLeft = _throttleLeft - 1);
      if (_throttleLeft <= 0) timer.cancel();
    });
  }

  String _name(AppLocalizations t, RoleRow role) =>
      roleDisplayName(t, roleKey: role.key, name: role.name, nameCustomized: role.nameCustomized);

  String _rowRoleName(AppLocalizations t, MemberRow row) => roleDisplayName(
        t,
        roleKey: row.roleKey,
        name: row.roleName,
        nameCustomized: row.roleNameCustomized,
      );

  /// R10a — your own row asks first. `false` = keep the sheet, keep the
  /// choice, send nothing.
  Future<bool> _confirmSelf(AppLocalizations t, List<RoleRow> roles) async {
    final to = roles.where((r) => r.id == _selected).firstOrNull;
    final body = t.memberRoleSelfConfirmBody(
      _rowRoleName(t, widget.member),
      to == null ? '' : _name(t, to),
    );
    return showConfirmDialog(
      context,
      title: t.memberRoleSelfConfirmTitle,
      body: widget.member.isOwner ? '${t.memberRoleSelfConfirmOwnerLine}\n$body' : body,
      cancelLabel: t.memberRoleSelfConfirmCancel,
      confirmLabel: t.memberRoleSelfConfirmCta,
      destructive: true,
      stacked: true,
    );
  }

  Future<void> _save(List<RoleRow> roles) async {
    final t = AppLocalizations.of(context);
    if (widget.member.isMe && !await _confirmSelf(t, roles)) return;
    if (!mounted) return;
    // Captured now: by the time the answer lands this sheet may be gone, and
    // the members screen under it may be too (its tab vanishes when the
    // viewer loses manage_members).
    final messenger = ScaffoldMessenger.of(context);
    final colors = context.appColors;
    final navigator = Navigator.of(context);
    setState(() => _error = null);

    final result = await ref
        .read(memberRoleChangeControllerProvider.notifier)
        .submit(target: widget.member, roleId: _selected);
    if (result == null) return;

    switch (result) {
      case MemberRoleChangeTakenBySession():
        if (mounted) navigator.pop();
      case MemberRoleChanged(:final row, :final stillManagesMembers):
        final role = _rowRoleName(t, row);
        widget.onMembersStale(row);
        if (mounted) navigator.pop();
        _toast(
          messenger,
          colors,
          !widget.member.isMe
              ? t.memberRoleSuccessToast(widget.member.email, role)
              : stillManagesMembers
                  ? t.memberRoleSuccessSelfToast(role)
                  : t.memberRoleSuccessSelfLostToast(role),
        );
        if (!stillManagesMembers) widget.onLostManageMembers?.call();
      case MemberRoleChangeRefused(:final error, :final stillManagesMembers):
        if (error.refetchMembers) widget.onMembersStale(null);
        if (error.problem == MemberRoleProblem.forbidden && !stillManagesMembers) {
          if (mounted) navigator.pop();
          _toast(messenger, colors, t.memberRoleLostManageMembersToast);
          widget.onLostManageMembers?.call();
          return;
        }
        if (error.closesSheet) {
          if (mounted) navigator.pop();
          _toast(messenger, colors, t.memberRoleGoneToast);
          return;
        }
        if (!mounted) return;
        setState(() {
          _error = error;
          if (error.resetSelection) _selected = widget.member.roleId;
          if (error.locksSheet) _locked = true;
        });
        if (error.retryAfterSeconds case final seconds?) _startThrottle(seconds);
    }
  }

  void _toast(ScaffoldMessengerState messenger, AppColorsX colors, String message) {
    // This sheet may be unmounted by now: messenger + colours were captured
    // before the await.
    if (!messenger.mounted) return;
    showAppToastOn(messenger, colors, message);
  }

  String? _errorCopy(AppLocalizations t, MemberRoleChangeError e) => switch (e.problem) {
        MemberRoleProblem.targetNotBelowActor => t.memberRoleErrorTargetNotBelow,
        MemberRoleProblem.exceedsActor => t.memberRoleErrorExceedsActor,
        MemberRoleProblem.forbidden => t.memberRoleErrorForbidden,
        MemberRoleProblem.lastOwner => t.memberRoleErrorLastOwner,
        MemberRoleProblem.busy => t.memberRoleErrorBusy,
        MemberRoleProblem.roleInvalid => t.memberRoleErrorRoleInvalid,
        MemberRoleProblem.generic => t.memberRoleErrorGeneric,
        // Rendered as the countdown banner / a toast, not here.
        MemberRoleProblem.throttled || MemberRoleProblem.gone => null,
      };

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final submitting = ref.watch(memberRoleChangeControllerProvider);
    final roles = ref.watch(rolesProvider);
    final throttled = _throttleLeft > 0;
    final error = _error;
    final errorCopy = error == null ? null : _errorCopy(t, error);
    final loaded = roles.valueOrNull;
    final usable = loaded != null && loaded.isNotEmpty ? loaded : null;

    final VoidCallback? onPrimary;
    if (_locked) {
      onPrimary = () => Navigator.of(context).pop();
    } else if (usable == null || submitting || throttled || _selected == widget.member.roleId) {
      // ★ no-op guard (SR-19): the current role is never sent.
      onPrimary = null;
    } else {
      onPrimary = () => _save(usable);
    }

    final Widget options = roles.when(
      loading: () => const _OptionsSkeleton(),
      error: (_, __) => _RolesLoadError(onRetry: () => ref.invalidate(rolesProvider)),
      data: (items) => items.isEmpty
          // An empty list from the server is the same error (ux R10 states).
          ? _RolesLoadError(onRetry: () => ref.invalidate(rolesProvider))
          : RadioGroup<String>(
              groupValue: _selected,
              onChanged: (id) {
                if (id == null || submitting || _locked) return;
                setState(() => _selected = id);
              },
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final role in items)
                    RoleRadioOption.fromRole(
                      t,
                      role,
                      viewerIsOwner: _iAmOwner,
                      isCurrent: role.id == widget.member.roleId,
                      locked: submitting || _locked,
                    ),
                ],
              ),
            ),
    );

    return PopScope(
      // Back / a tap on the barrier: not while the answer is pending (ux R10:
      // "ปิด sheet ด้วยการลาก/✕/back ไม่ได้จนได้คำตอบ").
      canPop: !submitting,
      child: GestureDetector(
        // …and not by dragging it down either: while sending, this claims
        // the vertical drag before the sheet's own drag-to-dismiss can.
        onVerticalDragStart: submitting ? (_) {} : null,
        onVerticalDragUpdate: submitting ? (_) {} : null,
        child: Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.s2),
              Center(
                child: Container(
                  width: 32,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.borderDefault,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.s4, AppSpacing.s2, AppSpacing.s2, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.s3),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(
                                widget.member.isMe ? t.memberRoleSheetTitleSelf : t.memberRoleSheetTitle,
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                            if (!widget.member.isMe)
                              Text(
                                widget.member.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodySm.copyWith(color: colors.textMuted),
                              ),
                          ],
                        ),
                      ),
                    ),
                    IconButton(
                      key: const ValueKey('member-role-dismiss'),
                      tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                      constraints: const BoxConstraints(
                        minWidth: AppSizes.tapTargetMin,
                        minHeight: AppSizes.tapTargetMin,
                      ),
                      onPressed: submitting ? null : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              const Divider(height: AppSpacing.s4),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (throttled) ...[
                        RoleWarningBanner(
                          icon: Icons.schedule,
                          tabularFigures: true,
                          body: t.memberRoleErrorThrottled(
                            (_throttleLeft ~/ 60).toString().padLeft(2, '0'),
                            (_throttleLeft % 60).toString().padLeft(2, '0'),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.s3),
                      ],
                      if (errorCopy != null) ...[
                        Semantics(liveRegion: true, child: ErrorBanner(message: errorCopy)),
                        const SizedBox(height: AppSpacing.s3),
                      ],
                      options,
                      CapabilityGate(
                        capability: manageRolesCapability,
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: TextButton(
                            style: TextButton.styleFrom(
                              minimumSize: const Size(0, AppSizes.tapTargetMin),
                            ),
                            // Nothing is saved yet, so closing first needs no
                            // question (ux R10 (ข)).
                            onPressed: submitting
                                ? null
                                : () {
                                    final navigator = Navigator.of(context);
                                    navigator.pop();
                                    unawaited(openRolesScreen(navigator.context));
                                  },
                            child: Text(t.roleSeeAllCapabilitiesLink),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.surface,
                  border: Border(top: BorderSide(color: colors.borderDefault)),
                ),
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.s4,
                      vertical: AppSpacing.s3,
                    ),
                    child: ElevatedButton(
                      key: const ValueKey('member-role-save'),
                      onPressed: onPrimary,
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
                      ),
                      child: Text(
                        _locked
                            ? t.memberRoleClose
                            : submitting
                                ? t.memberRoleSaving
                                : t.memberRoleSave,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RolesLoadError extends StatelessWidget {
  const _RolesLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return ErrorBanner(message: t.inviteRolesLoadError, onRetry: onRetry);
  }
}

/// ux R10 states: three card-shaped placeholders while `GET /roles` loads.
class _OptionsSkeleton extends StatelessWidget {
  const _OptionsSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.appColors;
    return Column(
      children: [
        for (var i = 0; i < 3; i++)
          Container(
            height: AppSizes.tapTargetMin,
            margin: const EdgeInsets.only(bottom: AppSpacing.s2),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadius.card),
            ),
          ),
      ],
    );
  }
}
