import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/capabilities.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/app_toast.dart';
import '../../../../core/ui/error_banner.dart';
import '../../application/role_delete_error.dart';
import '../../application/role_write_controller.dart';
import '../../application/role_write_error.dart';
import '../../domain/entities/role_entities.dart';
import '../../domain/role_actions_model.dart';
import '../copy/role_viewer_reason_copy.dart';
import '../copy/role_write_error_copy.dart';
import '../screens/members_screen.dart';
import 'role_screen_parts.dart';

/// R5 — ลบบทบาท (ux-wireframe R5 · AC-3.8 / AC-3.9b) · T-003-M08. Mobile twin
/// of web `RoleDeleteAction.tsx` (W09).
///
/// The "ลบบทบาทนี้" button of R3/R4 ("การจัดการอื่น"), what sits under it, and
/// the dialog it opens. What the button does comes from [deleteAffordance] —
/// the server's verdicts only.
///
///  - (ก) `canDelete.allowed` → a destructive confirm dialog, focus on "ไม่ลบ".
///    One confirmation = one DELETE (the controller's in-flight latch; while
///    sending, the dialog cannot be dismissed). Success → toast + back to R1.
///  - (ข) still in use — (1) `canDelete.reason = in_use` already: the button is
///    disabled and the panel shows UNDER it from `usage` (no need to press
///    first); (2) `409 ROLE_IN_USE` at confirm (someone joined meanwhile): the
///    dialog turns into (ข) with the numbers from `details`, and the role is
///    re-read.
///  - links to R6 only for a viewer who can open it (`can(manage_members)`, a
///    UX rule — R6 has its own guard and the server decides there); otherwise
///    the "คนที่จัดการสมาชิกได้…" line.
///  - other refusals per §E (`role_delete_error.dart`).
class RoleDeleteAction extends ConsumerStatefulWidget {
  const RoleDeleteAction({
    super.key,
    required this.role,
    required this.displayName,
    required this.isMine,
    required this.onRefetchRole,
    required this.onForbidden,
  });

  final RoleDetailView role;

  /// §0.2 display name — the dialog title, the toast and R6's title use it.
  final String displayName;

  /// `myMembership.roleId == role.id`.
  final bool isMine;
  final VoidCallback onRefetchRole;
  final VoidCallback onForbidden;

  /// Whether this action renders anything — callers lay out "การจัดการอื่น"
  /// around it.
  static bool isShown(RoleDetailView role) =>
      deleteAffordance(canEdit: role.canEdit, canDelete: role.canDelete, isSystem: role.isSystem)
          is! DeleteHidden;

  @override
  ConsumerState<RoleDeleteAction> createState() => _RoleDeleteActionState();
}

class _RoleDeleteActionState extends ConsumerState<RoleDeleteAction> {
  String? _banner;
  int _throttleLeft = 0;
  Timer? _throttleTimer;

  @override
  void dispose() {
    _throttleTimer?.cancel();
    super.dispose();
  }

  void _startThrottle(int seconds) {
    _throttleTimer?.cancel();
    setState(() => _throttleLeft = seconds);
    _throttleTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _throttleLeft = _throttleLeft - 1);
      if (_throttleLeft <= 0) timer.cancel();
    });
  }

  Future<void> _open() async {
    final t = AppLocalizations.of(context);
    setState(() => _banner = null);
    final controller = ref.read(roleWriteControllerProvider.notifier);
    final roleId = widget.role.id;
    final refetch = widget.onRefetchRole;
    final result = await showDialog<RoleDeleteResult>(
      context: context,
      builder: (_) => _DeleteDialog(
        roleId: roleId,
        roleName: widget.displayName,
        isMine: widget.isMine,
        send: () => controller.delete(roleId),
        onRefetchRole: refetch,
      ),
    );
    if (!mounted || result == null) return;
    switch (result) {
      case RoleDeleteDone():
        showAppToast(context, t.roleDeleteSuccessToast(widget.displayName));
        // `pop`, not `maybePop`: a dirty R3's guard must not ask "ทิ้งการแก้ไข?"
        // about a role that no longer exists. R1 is re-read by the controller.
        Navigator.of(context).pop();
      case RoleDeleteFailed(:final error):
        switch (error) {
          case RoleDeleteGone():
            showAppToast(context, t.roleDeleteGoneToast, variant: AppToastVariant.danger);
            Navigator.of(context).pop();
          case RoleDeleteForbidden():
            widget.onForbidden();
          case RoleDeleteThrottled(:final seconds):
            _startThrottle(seconds);
          case RoleDeleteRefused(:final problem, :final refetch):
            setState(() => _banner = roleBannerProblemCopy(t, problem, deleting: true));
            if (refetch.contains(RoleRefetch.role)) widget.onRefetchRole();
          case RoleDeleteInUse() || RoleDeleteHistoryLimit():
            // Handled inside the dialog, which stays open for them.
            break;
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final role = widget.role;
    final affordance = deleteAffordance(canEdit: role.canEdit, canDelete: role.canDelete, isSystem: role.isSystem);
    if (affordance is DeleteHidden) return const SizedBox.shrink();
    final submitting = ref.watch(roleWriteControllerProvider);
    final throttled = _throttleLeft > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        OutlinedButton(
          key: const ValueKey('role-delete-button'),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.tapTargetMin)),
          onPressed: affordance is DeleteEnabled && !throttled && !submitting ? _open : null,
          child: Text(t.roleFormDeleteCta),
        ),
        if (affordance is DeleteInUse) ...[
          const SizedBox(height: AppSpacing.s3),
          RoleInUsePanel(
            key: const ValueKey('role-in-use-panel'),
            roleId: role.id,
            roleName: widget.displayName,
            usage: role.usage,
            isMine: widget.isMine,
            showTitle: true,
            onOpenR6: (open) async {
              await open(Navigator.of(context));
              if (mounted) widget.onRefetchRole();
            },
          ),
        ],
        if (affordance is DeleteBlocked) ...[
          const SizedBox(height: AppSpacing.s2),
          Builder(builder: (context) {
            final copy = roleDeleteOnlyReasonBanner(t, affordance.reason);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(copy.title, style: AppTypography.bodySm.copyWith(fontWeight: FontWeight.w700)),
                Text(copy.body, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
              ],
            );
          }),
        ],
        if (throttled) ...[
          const SizedBox(height: AppSpacing.s3),
          RoleWarningBanner(
            icon: Icons.schedule,
            tabularFigures: true,
            body: t.roleFormErrorThrottled(
              (_throttleLeft ~/ 60).toString().padLeft(2, '0'),
              (_throttleLeft % 60).toString().padLeft(2, '0'),
            ),
          ),
        ],
        if (_banner != null) ...[
          const SizedBox(height: AppSpacing.s3),
          ErrorBanner(message: _banner!),
        ],
      ],
    );
  }
}

/// Opens R6 ("คนที่ใช้บทบาท …") on [nav]; completes when the person comes back.
typedef OpenRoleMembers = Future<void> Function(NavigatorState nav);

/// R5 (ข) — the count line (§0.2, zero parts dropped), what to do, and the way
/// to R6. On the page it carries its own title ([showTitle]); in the dialog
/// the dialog's heading is the title.
class RoleInUsePanel extends ConsumerWidget {
  const RoleInUsePanel({
    super.key,
    required this.roleId,
    required this.roleName,
    required this.usage,
    required this.isMine,
    required this.showTitle,
    required this.onOpenR6,
  });

  final String roleId;
  final String roleName;

  /// `null` = the 409 carried no usable numbers — no count line, no counts.
  final RoleUsage? usage;
  final bool isMine;
  final bool showTitle;

  /// The caller decides how to leave (the dialog closes itself first) and
  /// what to re-read on the way back.
  final Future<void> Function(OpenRoleMembers open) onOpenR6;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final muted = AppTypography.bodySm.copyWith(color: colors.textMuted);
    // UX rule only (the members tab uses the same one) — R6 is guarded itself.
    final canOpenMembers = ref.watch(activeOrgProvider)?.can(manageMembersCapability) ?? false;
    final u = usage;
    final counts = u == null ? '' : roleInUseCountLine(t, u, isMine: isMine);
    final onlyMe = u != null && inUseOnlyMe(u, isMine: isMine);
    final members = u?.activeMembers ?? 0;
    final invitations = u?.pendingInvitations ?? 0;

    Future<void> openR6(NavigatorState nav) => nav.push(MaterialPageRoute<void>(
          builder: (_) => RoleMembersScreen(roleId: roleId, roleName: roleName),
        ));

    Widget link(String key, String label) => Padding(
          padding: const EdgeInsets.only(top: AppSpacing.s2),
          child: OutlinedButton(
            key: ValueKey(key),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.tapTargetMin)),
            onPressed: () => onOpenR6(openR6),
            child: Text(label, textAlign: TextAlign.center),
          ),
        );

    return Semantics(
      container: true,
      label: t.roleDeleteInUseTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showTitle) Text(t.roleDeleteInUseTitle, style: AppTypography.bodySm.copyWith(fontWeight: FontWeight.w700)),
          if (counts.isNotEmpty) Text(counts, style: muted),
          Text(onlyMe ? t.roleDeleteInUseSelfNote : t.roleDeleteInUseBody, style: muted),
          if (canOpenMembers) ...[
            // A mobile R6 shows invitations first, so both land on the same
            // screen (ux R6: "เลื่อนไปส่วนคำเชิญ" is where it already starts).
            if (members > 0) link('role-in-use-members', t.roleDeleteViewMembersCta(members)),
            if (invitations > 0) link('role-in-use-invitations', t.roleDeleteViewInvitationsCta(invitations)),
          ] else
            Text(t.roleDeleteNoManageMembersNote, style: muted),
        ],
      ),
    );
  }
}

/// R5 (ก) → possibly (ข). Runs the DELETE itself, so "one confirmation = one
/// DELETE" holds without the caller's help; pops with the result for anything
/// that leaves the dialog, stays open for in-use and the history limit.
class _DeleteDialog extends StatefulWidget {
  const _DeleteDialog({
    required this.roleId,
    required this.roleName,
    required this.isMine,
    required this.send,
    required this.onRefetchRole,
  });

  final String roleId;
  final String roleName;
  final bool isMine;
  final Future<RoleDeleteResult?> Function() send;
  final VoidCallback onRefetchRole;

  @override
  State<_DeleteDialog> createState() => _DeleteDialogState();
}

class _DeleteDialogState extends State<_DeleteDialog> {
  final _cancelFocus = FocusNode(debugLabel: 'role-delete-cancel');
  bool _submitting = false;
  String? _error;

  /// Set once a `409 ROLE_IN_USE` turned the dialog into (ข).
  ({RoleUsage? usage})? _inUse;

  @override
  void initState() {
    super.initState();
    // Destructive → default focus on "ไม่ลบ" (ui.md §1 focusCancel).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _cancelFocus.requestFocus();
    });
  }

  @override
  void dispose() {
    _cancelFocus.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_submitting || _error != null) return;
    final t = AppLocalizations.of(context);
    setState(() => _submitting = true);
    final result = await widget.send();
    if (!mounted) return;
    if (result == null) {
      // Another write was in flight — nothing was sent for this press.
      setState(() => _submitting = false);
      return;
    }
    switch (result) {
      case RoleDeleteFailed(error: RoleDeleteInUse(:final usage)):
        setState(() {
          _submitting = false;
          _inUse = (usage: usage);
        });
        widget.onRefetchRole();
      case RoleDeleteFailed(error: RoleDeleteHistoryLimit(:final limit)):
        setState(() {
          _submitting = false;
          // ux §E: in R5 itself, confirm closed. Without `limit` the
          // reason-banner sentence (no number) — never an invented one.
          _error = limit != null ? t.roleFormErrorHistoryLimitReached(limit) : t.roleDeleteHistoryLimitReachedBody;
        });
        widget.onRefetchRole();
      default:
        Navigator.of(context).pop(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    final width = MediaQuery.sizeOf(context).width;
    final dialogWidth = (width * AppSizes.dialogInlineWidthFactor).clamp(0.0, AppSizes.dialogMaxW);
    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.button));
    final inUse = _inUse;

    final Widget content;
    if (inUse != null) {
      content = Column(
        key: const ValueKey('role-delete-in-use-dialog'),
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t.roleDeleteInUseTitle, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s3),
          RoleInUsePanel(
            roleId: widget.roleId,
            roleName: widget.roleName,
            usage: inUse.usage,
            isMine: widget.isMine,
            showTitle: false,
            onOpenR6: (open) async {
              final nav = Navigator.of(context);
              final refetch = widget.onRefetchRole;
              nav.pop();
              await open(nav);
              refetch();
            },
          ),
          const SizedBox(height: AppSpacing.s6),
          OutlinedButton(
            key: const ValueKey('role-delete-close'),
            autofocus: true,
            onPressed: () => Navigator.of(context).pop(),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(AppSizes.tapTargetMin), shape: buttonShape),
            child: Text(t.roleDeleteClose),
          ),
        ],
      );
    } else {
      final cancel = OutlinedButton(
        key: const ValueKey('role-delete-cancel'),
        focusNode: _cancelFocus,
        onPressed: _submitting ? null : () => Navigator.of(context).pop(),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(AppSizes.tapTargetMin), shape: buttonShape),
        child: Text(t.roleDeleteConfirmCancel),
      );
      final confirm = ElevatedButton(
        key: const ValueKey('role-delete-confirm'),
        onPressed: _submitting || _error != null ? null : _confirm,
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.btnDangerBg,
          foregroundColor: colors.btnFg,
          minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
          shape: buttonShape,
        ),
        child: Text(_submitting ? t.roleDeleteConfirmDeleting : t.roleDeleteConfirmCta, textAlign: TextAlign.center),
      );
      content = Column(
        key: const ValueKey('role-delete-dialog'),
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(t.roleDeleteConfirmTitle(widget.roleName), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s3),
          Text(t.roleDeleteConfirmBody, style: AppTypography.bodySm.copyWith(color: colors.textMuted)),
          if (_error != null) ...[
            const SizedBox(height: AppSpacing.s4),
            ErrorBanner(message: _error!),
          ],
          const SizedBox(height: AppSpacing.s6),
          // ux R5 platform: stacked full-width when narrow, side by side when
          // there is room (cancel first, the destructive action last).
          LayoutBuilder(
            builder: (context, box) => box.maxWidth < 360
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [confirm, const SizedBox(height: AppSpacing.s3), cancel],
                  )
                : Row(
                    children: [
                      Expanded(child: cancel),
                      const SizedBox(width: AppSpacing.s3),
                      Expanded(child: confirm),
                    ],
                  ),
          ),
        ],
      );
    }

    return PopScope(
      // While the DELETE is in flight the dialog stays (barrier + back).
      canPop: !_submitting,
      child: Dialog(
        insetPadding: EdgeInsets.symmetric(horizontal: (width - dialogWidth) / 2, vertical: AppSpacing.s6),
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card)),
        child: SizedBox(
          width: dialogWidth,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.s6),
            // Like AlertDialog: the dialog names its route for a screen reader.
            child: Semantics(
              scopesRoute: true,
              namesRoute: true,
              explicitChildNodes: true,
              label: inUse != null ? t.roleDeleteInUseTitle : t.roleDeleteConfirmTitle(widget.roleName),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}
