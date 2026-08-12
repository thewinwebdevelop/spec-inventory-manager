import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/skeleton.dart';
import '../../application/org_providers.dart';
import '../../application/paged_controllers.dart';
import '../../domain/backup_owner_nudge.dart';
import '../../domain/entities/org_entities.dart';
import '../../domain/expiry.dart';
import '../widgets/expiry_text.dart';
import '../widgets/role_label.dart';
import 'invite_member_screen.dart';

/// S6 — สมาชิก, mobile (ux-wireframe §7 + §13).
///
/// **One screen, two sections** (ux's answer to Q1): pending invitations
/// above, members below, from two endpoints, with no combined endpoint asked
/// for. Each section owns its loading and its error — a members list that
/// fails must not take the invitations with it, because the two are separate
/// jobs and only one of them is broken.
///
/// This round is READ + INVITE. Row actions (เปลี่ยนสิทธิ์ · ถอดออกจากร้าน ·
/// ออกจากร้านนี้ · ออกลิงก์ใหม่ · ยกเลิกคำเชิญ) are not built yet, so the rows
/// are deliberately NOT tappable: an action sheet that opens onto nothing is
/// worse than no affordance at all.
class MembersScreen extends ConsumerStatefulWidget {
  const MembersScreen({super.key});

  @override
  ConsumerState<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends ConsumerState<MembersScreen> {
  bool _showRevoked = false;
  bool _showArchivedInvites = false;

  /// `status` is part of the controller's identity, so flipping a toggle
  /// builds a separate controller rather than mutating a list mid-flight.
  String get _memberStatus => _showRevoked ? 'all' : 'active';
  String get _inviteStatus => _showArchivedInvites ? 'all' : 'pending';

  Future<void> _openInvite({String? presetRoleKey}) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => InviteMemberScreen(initialRoleKey: presetRoleKey),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final members = ref.watch(membersControllerProvider(_memberStatus));
    final invitations = ref.watch(invitationsControllerProvider(_inviteStatus));

    return Scaffold(
      appBar: AppBar(
        title: Text(t.membersTitle),
        actions: [
          IconButton(
            onPressed: () => _openInvite(),
            icon: const Icon(Icons.person_add_alt),
            // The plus comes from the component, never from the string
            // (ui.md §2.7) — and the icon needs a spoken label (§14).
            tooltip: t.membersInviteCta,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.s4),
        children: [
          _BackupOwnerNudge(
            members: members,
            onInviteOwner: () => _openInvite(presetRoleKey: 'owner'),
          ),
          _InvitationsSection(
            state: invitations,
            showArchived: _showArchivedInvites,
            onToggleArchived: () =>
                setState(() => _showArchivedInvites = !_showArchivedInvites),
            onRetry: () =>
                ref.read(invitationsControllerProvider(_inviteStatus).notifier).refresh(),
            onLoadMore: () =>
                ref.read(invitationsControllerProvider(_inviteStatus).notifier).loadMore(),
          ),
          _MembersSection(
            state: members,
            showRevoked: _showRevoked,
            onToggleRevoked: () => setState(() => _showRevoked = !_showRevoked),
            onRetry: () => ref.read(membersControllerProvider(_memberStatus).notifier).refresh(),
            onLoadMore: () => ref.read(membersControllerProvider(_memberStatus).notifier).loadMore(),
            onInvite: () => _openInvite(),
          ),
        ],
      ),
    );
  }
}

/// D-030's nudge. Everything about whether it appears is in
/// [shouldShowBackupOwnerNudge]; everything about what it says is in
/// `app_th.arb`. Dismissal is remembered per shop for this app run only
/// (ux-wireframe §7: "กลับมาแสดงอีกครั้งเมื่อเปิดแอปรอบใหม่") — which is why
/// the provider holding it is NOT autoDispose and NOT persisted.
class _BackupOwnerNudge extends ConsumerWidget {
  const _BackupOwnerNudge({required this.members, required this.onInviteOwner});

  final PagedState<MemberRow> members;
  final VoidCallback onInviteOwner;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final orgId = ref.watch(activeOrgIdProvider);
    final dismissed = ref.watch(backupOwnerNudgeDismissedProvider);

    if (orgId == null || dismissed.contains(orgId)) return const SizedBox.shrink();
    if (!shouldShowBackupOwnerNudge(members: members.items, complete: members.isComplete)) {
      return const SizedBox.shrink();
    }

    final colors = context.appColors;
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.s4),
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        // info, never warning: nothing is wrong right now, and ux forbids a
        // red icon here as explicitly as it forbids the word "เสี่ยง".
        color: colors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, size: 20, color: colors.accentText),
              const SizedBox(width: AppSpacing.s2),
              Expanded(
                child: Text(
                  t.backupOwnerNudgeBody,
                  style: AppTypography.bodySm.copyWith(color: colors.accentText),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s3),
          Row(
            children: [
              FilledButton(
                onPressed: onInviteOwner,
                child: Text(t.backupOwnerNudgeCta),
              ),
              const SizedBox(width: AppSpacing.s3),
              TextButton(
                onPressed: () => ref
                    .read(backupOwnerNudgeDismissedProvider.notifier)
                    .update((set) => {...set, orgId}),
                child: Text(t.backupOwnerNudgeDismiss),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InvitationsSection extends StatelessWidget {
  const _InvitationsSection({
    required this.state,
    required this.showArchived,
    required this.onToggleArchived,
    required this.onRetry,
    required this.onLoadMore,
  });

  final PagedState<InvitationRow> state;
  final bool showArchived;
  final VoidCallback onToggleArchived;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    if (state.loading) {
      return const Padding(
        padding: EdgeInsets.only(bottom: AppSpacing.s4),
        // Shaped like ONE invitation row, which is what ux's skeleton says.
        child: SessionListSkeleton(rowCount: 1),
      );
    }
    if (state.failure != null) {
      return _SectionError(message: t.invitationsLoadError, onRetry: onRetry);
    }
    // "ถ้าไม่มีคำเชิญค้าง = ซ่อนทั้งส่วน" (ux-wireframe §7) — an empty section
    // with a heading is clutter reporting the absence of work.
    if (state.items.isEmpty && !showArchived) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          t.membersPendingSection(state.items.where((i) => i.isPending).length),
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: AppSpacing.s2),
        for (final invitation in state.items) _InvitationTile(invitation: invitation),
        if (state.hasMore)
          TextButton(onPressed: onLoadMore, child: Text(t.membersLoadMore)),
        TextButton(
          onPressed: onToggleArchived,
          child: Text(showArchived ? t.invitationHideArchived : t.invitationShowArchived),
        ),
        const SizedBox(height: AppSpacing.s4),
      ],
    );
  }
}

class _InvitationTile extends StatelessWidget {
  const _InvitationTile({required this.invitation});

  final InvitationRow invitation;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final status = switch (invitation.status) {
      'pending' => t.invitationStatusPending,
      'expired' => t.invitationStatusExpired,
      'cancelled' => t.invitationStatusCancelled,
      'accepted' => t.invitationStatusAccepted(
          // The instant it was accepted — NOT `formatExpiryLine`, which
          // words its argument as a deadline still ahead of you.
          invitation.acceptedAt == null ? '' : formatShopDateTime(invitation.acceptedAt!),
        ),
      // An unknown status is shown as-is rather than guessed at — the set is
      // the server's, and inventing a Thai label for a value this build has
      // not seen would be worse than showing the raw one.
      _ => invitation.status,
    };

    return ListTile(
      minVerticalPadding: 12,
      leading: const Icon(Icons.mail_outline),
      title: Text(invitation.email),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Role and status as TEXT, always (§14).
          Text('${roleLabel(t, invitation.roleKey, invitation.roleName)} · $status'),
          // The expiry line belongs to a link that can still be used. Printing
          // it on a cancelled invitation would advertise a dead link's
          // deadline.
          if (invitation.isPending) Text(formatExpiryLine(t, invitation.expiresAt)),
          if (invitation.acceptedUserCreatedAfterInvite)
            Text(
              t.invitationAcceptedAfterInviteNote,
              style: AppTypography.bodySm.copyWith(color: context.appColors.textMuted),
            ),
        ],
      ),
    );
  }
}

class _MembersSection extends StatelessWidget {
  const _MembersSection({
    required this.state,
    required this.showRevoked,
    required this.onToggleRevoked,
    required this.onRetry,
    required this.onLoadMore,
    required this.onInvite,
  });

  final PagedState<MemberRow> state;
  final bool showRevoked;
  final VoidCallback onToggleRevoked;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;
  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);

    if (state.loading) return const SessionListSkeleton(rowCount: 3);
    if (state.failure != null) {
      return _SectionError(message: t.membersLoadError, onRetry: onRetry);
    }

    final active = state.items.where((m) => m.isActive).toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t.membersSection(active.length), style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSpacing.s2),
        for (final member in state.items) _MemberTile(member: member),
        if (active.length == 1 && active.single.isMe)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.s4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.membersOnlyYou),
                const SizedBox(height: AppSpacing.s2),
                FilledButton(onPressed: onInvite, child: Text(t.membersInviteCta)),
              ],
            ),
          ),
        if (state.hasMore) TextButton(onPressed: onLoadMore, child: Text(t.membersLoadMore)),
        TextButton(
          onPressed: onToggleRevoked,
          child: Text(showRevoked ? t.membersHideRevoked : t.membersShowRevoked),
        ),
      ],
    );
  }
}

class _MemberTile extends StatelessWidget {
  const _MemberTile({required this.member});

  final MemberRow member;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final revoked = !member.isActive;
    final colors = context.appColors;

    return Opacity(
      // Revoked rows are dimmed AND labelled — the dimming is the hint, the
      // label is the information (§14).
      opacity: revoked ? 0.6 : 1,
      child: ListTile(
        minVerticalPadding: 12,
        leading: CircleAvatar(
          backgroundColor: colors.surfaceMuted,
          child: Text(member.email.isEmpty ? '?' : member.email.characters.first),
        ),
        title: Row(
          children: [
            Flexible(child: Text(member.email, overflow: TextOverflow.ellipsis)),
            if (member.isMe) ...[
              const SizedBox(width: AppSpacing.s2),
              // `isMe` is the SERVER's answer (api-spec §3.7) — no screen
              // compares user ids to work out whose row this is.
              Text(t.membersYouBadge, style: AppTypography.bodySm),
            ],
          ],
        ),
        subtitle: Text(
          '${roleLabel(t, member.roleKey, member.roleName)} · '
          '${revoked ? t.membersStatusRevoked : t.membersStatusActive}',
        ),
      ),
    );
  }
}

class _SectionError extends StatelessWidget {
  const _SectionError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(message),
          TextButton(onPressed: onRetry, child: Text(t.actionRetry)),
        ],
      ),
    );
  }
}
