import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/l10n/l10n.dart';
import '../../../../core/session/session_controller.dart';
import '../../../../core/theme/app_theme.dart';
import '../../application/org_providers.dart';
import 'role_label.dart';

/// S3 — the shop switcher, mobile (ux-wireframe §4 + §13: the shop name sits
/// on the AppBar and opens a **bottom sheet**, not a dropdown).
///
/// Why the name is on the AppBar at all: "org context ต้องเห็นตลอดเวลา" is a
/// rule of its own (ux-heuristic). On web the shop lives in the URL and two
/// tabs can be two shops; on mobile there is exactly one active shop and no
/// address bar, so the title IS the only place that fact can live.
class OrgSwitcherTitle extends ConsumerWidget {
  const OrgSwitcherTitle({super.key, this.onCreateOrganization});

  final VoidCallback? onCreateOrganization;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(activeOrgProvider);
    if (active == null) {
      // No shop, no switcher. Reaching this means a route guard let an
      // org-scoped screen build without one; showing an empty switcher would
      // dress that bug up as a UI state.
      return const SizedBox.shrink();
    }

    return InkWell(
      onTap: () => showOrgSwitcherSheet(context, onCreateOrganization: onCreateOrganization),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s2, vertical: AppSpacing.s2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                active.name,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            // The caret is decoration; the semantics label below is what a
            // screen reader hears (§14 — an icon never carries meaning alone).
            const Icon(Icons.arrow_drop_down),
          ],
        ),
      ),
    );
  }
}

Future<void> showOrgSwitcherSheet(
  BuildContext context, {
  VoidCallback? onCreateOrganization,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: context.appColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
    ),
    builder: (_) => _OrgSwitcherSheet(onCreateOrganization: onCreateOrganization),
  );
}

class _OrgSwitcherSheet extends ConsumerWidget {
  const _OrgSwitcherSheet({this.onCreateOrganization});

  final VoidCallback? onCreateOrganization;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final activeId = ref.watch(activeOrgIdProvider);
    final orgs = ref.watch(myOrganizationsProvider);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.s4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s6),
              child: Text(t.orgSwitcherTitle, style: Theme.of(context).textTheme.titleMedium),
            ),
            const SizedBox(height: AppSpacing.s3),
            orgs.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(AppSpacing.s6),
                child: LinearProgressIndicator(),
              ),
              // A failed shop list must not take the screen down with it
              // (ux-wireframe §4): the person is still inside a working shop,
              // and the only thing broken is the list of the others.
              error: (error, _) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.s6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Its own copy, not `failureMessage(t, failure)`: what
                    // failed here is the LIST, and the person needs to know
                    // the shop they are in is unaffected.
                    Text(t.orgPickerError),
                    TextButton(
                      onPressed: () => ref.invalidate(myOrganizationsProvider),
                      child: Text(t.actionRetry),
                    ),
                  ],
                ),
              ),
              data: (items) => Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final org in items)
                      ListTile(
                        minVerticalPadding: 12,
                        // ✓ AND the words "ร้านที่ใช้อยู่" — never the tick
                        // alone (§14: status is never colour or icon only).
                        leading: Icon(
                          org.id == activeId ? Icons.check : null,
                          color: context.appColors.primary,
                        ),
                        title: Text(org.name),
                        subtitle: Text(
                          org.id == activeId
                              ? '${roleLabel(t, org.roleKey, org.roleName)} · ${t.orgSwitcherCurrent}'
                              : roleLabel(t, org.roleKey, org.roleName),
                        ),
                        onTap: org.id == activeId
                            ? null
                            : () {
                                // One write, then close. Every provider under
                                // `activeOrgIdProvider` rebuilds off it and the
                                // old shop's state is disposed (mobile.md §3.2).
                                enterOrganization(ref, org);
                                Navigator.of(context).pop();
                              },
                      ),
                    const Divider(),
                    ListTile(
                      minVerticalPadding: 12,
                      leading: const Icon(Icons.add),
                      title: Text(t.orgCreateCta),
                      onTap: () {
                        Navigator.of(context).pop();
                        onCreateOrganization?.call();
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
