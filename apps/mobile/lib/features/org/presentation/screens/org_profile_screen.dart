import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_failure.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/security/screenshot_guard.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/skeleton.dart';
import '../../application/org_providers.dart';
import '../../application/tax_reveal_session.dart';
import '../../domain/entities/org_entities.dart';
import '../../domain/tax_reveal.dart';

/// ★ M-07 — S4 on mobile, for the sake of one card: the shop's tax identity.
///
/// ── Scope, stated because it is deliberately narrow ───────────────────────
/// READ and REVEAL only. There is no form here: F-002 declared the tax profile
/// a web job (§13 item 3), and adding an editor would be adding scope nobody
/// asked for. An Owner whose shop has no declaration is told where the form
/// is rather than left at a dead end.
///
/// ── The ★ part ────────────────────────────────────────────────────────────
/// These thirteen digits are a national ID when the taxpayer is a person, and
/// this is the only screen in the mobile app that can show them. Three
/// controls, none of which is sufficient alone:
///
///  1. `FLAG_SECURE` (Android) / app-switcher obscuring (iOS) while the number
///     is on screen — F-001 built the ref-counted scope for the password
///     fields and it applies unchanged here. It blanks the OS thumbnail, which
///     Dart cannot do after the fact because the snapshot is taken without
///     asking.
///  2. Dropping the value when the app leaves the foreground
///     (`TaxRevealController`) — because the flag is best-effort and the OS
///     snapshot races the frame.
///  3. Never storing it. No cache, no field on the repository, no
///     `SharedPreferences`, no log line. Seeing it again costs another
///     audited, rate-limited request, which is what §3.16 is built around.
class OrgProfileScreen extends ConsumerStatefulWidget {
  const OrgProfileScreen({super.key});

  @override
  ConsumerState<OrgProfileScreen> createState() => _OrgProfileScreenState();
}

class _OrgProfileScreenState extends ConsumerState<OrgProfileScreen>
    with WidgetsBindingObserver {
  VoidCallback? _releaseScreenshotGuard;

  /// ★ The revealed number lives HERE, in the state of the screen that shows
  /// it — not in a provider that outlives screens. That is what makes "leaving
  /// the screen drops it" a fact about storage rather than a rule somebody has
  /// to remember, and it is the security review's Critical finding answered at
  /// the root.
  late final TaxRevealSession _reveal;

  @override
  void initState() {
    super.initState();
    _reveal = TaxRevealSession(
      reveal: () => ref.read(orgScopedRepositoryProvider).revealTaxId(),
      onChanged: () {
        if (mounted) setState(() {});
      },
    );
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      _reveal.onLifecycle(state);

  @override
  void dispose() {
    _releaseScreenshotGuard?.call();
    WidgetsBinding.instance.removeObserver(this);
    // The number goes with this object. `dispose` only moves the epoch, so a
    // response still in flight cannot call back into a dead widget.
    _reveal.dispose();
    super.dispose();
  }

  /// Hold the OS-level guard for exactly as long as a number is on screen.
  ///
  /// Not for the whole screen: the masked value is not sensitive, and a
  /// permanently-blanked thumbnail for a screen that usually shows `•••3454`
  /// would be a cost with no benefit — the kind of thing people turn off.
  void _syncScreenshotGuard(RevealState state) {
    final shouldGuard = state is RevealShown || state is RevealLoading;
    if (shouldGuard && _releaseScreenshotGuard == null) {
      _releaseScreenshotGuard = ScreenshotGuardScope.acquire();
    } else if (!shouldGuard && _releaseScreenshotGuard != null) {
      _releaseScreenshotGuard!();
      _releaseScreenshotGuard = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final profile = ref.watch(orgProfileProvider);
    final reveal = _reveal.state;

    // Guard acquired during `loading` too: the request is in flight and the
    // number is about to be painted, and acquiring only on arrival would leave
    // the first frame unprotected.
    _syncScreenshotGuard(reveal);

    return Scaffold(
      appBar: AppBar(title: Text(t.orgProfileTitle)),
      body: SafeArea(
        child: profile.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.s6),
            child: SessionListSkeleton(),
          ),
          error: (_, __) => Padding(
            padding: const EdgeInsets.all(AppSpacing.s6),
            child: ErrorBanner(
              message: t.taxLoadError,
              onRetry: () => ref.invalidate(orgProfileProvider),
            ),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.all(AppSpacing.s6),
            children: [
              Text(data.name, style: AppTypography.headingMd),
              const SizedBox(height: AppSpacing.s6),
              _TaxCard(profile: data, reveal: reveal, onPress: _reveal.press),
            ],
          ),
        ),
      ),
    );
  }
}

class _TaxCard extends StatelessWidget {
  const _TaxCard({required this.profile, required this.reveal, required this.onPress});

  final OrgProfileView profile;
  final RevealState reveal;
  final Future<void> Function() onPress;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final colors = context.appColors;
    // ★ From the RESPONSE, not from the session.
    //
    // The review found the session's capability set empty for every entry
    // point except create-shop: the picker and the switcher both call
    // `enterOrganization` without one. So a real Owner arriving from the
    // picker got `{}` — and the read-only tier, with no masked number and no
    // reveal button at all. It failed closed, which is why nothing screamed,
    // and AC-7.4's positive half was simply not delivered.
    //
    // `myMembership.capabilities` is required by the contract on this very
    // response, so the tier is now decided by what the server says about this
    // member NOW, rather than by a snapshot taken when they picked the shop —
    // which also means a role change stops being stale.
    final capabilities = profile.capabilities;

    final view = taxCardView(
      complete: profile.taxProfileComplete,
      capabilities: capabilities,
      entityType: profile.entityType,
      taxIdMasked: profile.taxIdMasked,
      vatRegistered: profile.vatRegistered,
      branchCode: profile.branchCode,
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.s4),
      decoration: BoxDecoration(
        border: Border.all(color: colors.borderDefault),
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(t.taxTitle, style: AppTypography.headingSm),
          const SizedBox(height: AppSpacing.s3),
          switch (view) {
            // No form on mobile (§13 item 3) — so the reader is pointed at the
            // place that has one instead of being offered a button that is not
            // there.
            TaxCardUndeclared(canEdit: final canEdit) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.taxUndeclaredReadOnly, style: AppTypography.bodySm),
                  if (canEdit) ...[
                    const SizedBox(height: AppSpacing.s2),
                    Text(t.taxEditOnWebHint, style: AppTypography.bodySm),
                  ],
                ],
              ),
            // ux Q13 / AC-7.4: not one digit, not even the last four.
            TaxCardSummary(vatRegistered: final vat) => Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    vat == null ? t.taxTitle : (vat ? t.taxVatYes : t.taxVatNo),
                    style: AppTypography.bodySm,
                  ),
                  const SizedBox(height: AppSpacing.s2),
                  Text(t.taxDeclaredReadOnlyHint, style: AppTypography.bodySm),
                ],
              ),
            TaxCardDetails() => _TaxDetails(view: view, reveal: reveal, onPress: onPress),
          },
        ],
      ),
    );
  }
}

class _TaxDetails extends StatelessWidget {
  const _TaxDetails({required this.view, required this.reveal, required this.onPress});

  final TaxCardDetails view;
  final RevealState reveal;
  final Future<void> Function() onPress;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final shown = visibleTaxId(reveal);
    final loading = reveal is RevealLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Row(label: t.taxEntityTypeLabel, value: _entityLabel(t, view.entityType)),
        _Row(
          selectable: true,
          label: t.taxIdLabel,
          // The full number when it has been asked for, the mask otherwise.
          // There is no third state: `visibleTaxId` returns null unless the
          // state that HOLDS a number is the current one.
          value: shown ?? view.taxIdMasked ?? '—',
        ),
        _Row(
          label: t.taxVatLabel,
          value: view.vatRegistered == null
              ? '—'
              : (view.vatRegistered! ? t.taxVatYes : t.taxVatNo),
        ),
        _Row(
          label: t.taxBranchLabel,
          value: view.branchCode == '00000'
              ? t.taxBranchHeadOffice
              : (view.branchCode ?? '—'),
        ),
        const SizedBox(height: AppSpacing.s4),
        if (reveal is RevealError) ...[
          // The failure decides the sentence: a spent quota (429, with its own
          // countdown copy) must not read like a declaration that was removed
          // (404). `failureMessage` is the shared table; the generic line is
          // the honest fallback when the controller could not classify it.
          ErrorBanner(
            message: switch ((reveal as RevealError).failure) {
              final ApiFailure f => failureMessage(t, f),
              _ => t.taxRevealError,
            },
          ),
          const SizedBox(height: AppSpacing.s3),
        ],
        FilledButton(
          onPressed: loading ? null : onPress,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(AppSizes.tapTargetMin),
          ),
          child: Text(loading ? t.taxRevealLoading : (shown != null ? t.taxHide : t.taxReveal)),
        ),
        const SizedBox(height: AppSpacing.s2),
        // §5: said BEFORE the press, because the press is recorded.
        Text(t.taxRevealNotice, style: AppTypography.bodySm),
        // …and the mobile-only consequence, also said before it happens, so a
        // number vanishing after a phone call does not read as a bug.
        if (shown != null) ...[
          const SizedBox(height: AppSpacing.s2),
          Text(t.taxHiddenOnResumeHint, style: AppTypography.bodySm),
        ],
      ],
    );
  }

  String _entityLabel(AppLocalizations t, String? entityType) => switch (entityType) {
        'personal' => t.taxEntityPersonal,
        'company' => t.taxEntityCompany,
        _ => '—',
      };
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.selectable = false});

  final String label;
  final String value;

  /// Only the tax id row. M-07 asks for the number to be copyable — an owner
  /// reading it to an accountant should not transcribe thirteen digits by eye
  /// — but the review is right that the clipboard leaves this app's control
  /// (Android 13 shows a preview outside the FLAG_SECURE window; iOS syncs the
  /// pasteboard to the user's other devices). So selection is on the row that
  /// needs it and nowhere else. Marking the clip sensitive natively is filed
  /// for @frontend + @devops — it needs a platform channel on both sides.
  final bool selectable;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.s2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.bodySm),
          // `SelectableText`: M-07 asks whether the number can be COPIED, and
          // an owner reading it out to an accountant should not have to
          // transcribe thirteen digits by eye.
          if (selectable)
            SelectableText(value, style: AppTypography.bodyMd)
          else
            Text(value, style: AppTypography.bodyMd),
        ],
      ),
    );
  }
}
