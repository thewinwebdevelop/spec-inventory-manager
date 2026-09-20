import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/error/api_failure.dart';
import '../../../../core/l10n/l10n.dart';
import '../../../../core/ui/error_banner.dart';
import '../../../../core/ui/skeleton.dart';
import '../../application/org_providers.dart';
import '../widgets/role_label.dart';

/// S1 — เลือกร้าน, mobile (ux-wireframe §2 + §13: full screen, no back button,
/// rows at least 56px so they are comfortable to tap).
///
/// Reached when the session is `SessionAuthed(active: null)` — signed in, no
/// shop chosen. That is a state, not an error: the router sends people here
/// rather than to login, which is why `SessionState` keeps the two apart.
///
/// All four states (design-system §2 / gate rule 7): skeleton shaped like the
/// real rows, an empty state with a way forward, an error with a retry, data.
class OrgPickerScreen extends ConsumerWidget {
  const OrgPickerScreen({super.key, this.onCreateOrganization});

  /// Navigation is the caller's job — the router lands with F-006, and this
  /// screen should not grow a dependency on it in the meantime.
  final VoidCallback? onCreateOrganization;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final orgs = ref.watch(myOrganizationsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(t.orgPickerTitle)),
      body: orgs.when(
        loading: () => const _PickerSkeleton(),
        error: (error, _) => ErrorBanner(
          message: error is ApiFailure ? failureMessage(t, error) : t.orgPickerError,
          onRetry: () => ref.invalidate(myOrganizationsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return _EmptyState(t: t, onCreate: onCreateOrganization);
          }
          return ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(t.orgPickerSubtitle(items.length)),
              ),
              for (final org in items)
                ListTile(
                  // §13: at least 56px — comfortable on a phone, and the
                  // 44px tap-target floor applies to every platform (§14).
                  minVerticalPadding: 12,
                  title: Text(org.name),
                  // The role is TEXT, never colour alone (§14).
                  subtitle: Text(roleLabel(t, org.roleKey, org.roleName)),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => enterOrganization(ref, org),
                ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: OutlinedButton(
                  onPressed: onCreateOrganization,
                  // Secondary: the common case is picking an existing shop,
                  // not making another one (§2).
                  child: Text(t.orgCreateCta),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _PickerSkeleton extends StatelessWidget {
  const _PickerSkeleton();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.all(16),
        // Shaped like the rows it replaces, not a spinner (design-system §2).
        //
        // `SessionListSkeleton` is generic in shape (`rowCount`) and only its
        // NAME is auth-specific — a stale name in `core/ui/`, recorded as a
        // debt rather than renamed here, because renaming it touches auth's
        // widget tests and has nothing to do with F-002.
        child: SessionListSkeleton(rowCount: 3),
      );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.t, this.onCreate});

  final AppLocalizations t;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(t.orgPickerEmptyTitle, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            // Says what to do about it, including the case this screen cannot
            // fix: somebody else has to send you a link.
            Text(t.orgPickerEmptyBody, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onCreate, child: Text(t.orgCreateCta)),
          ],
        ),
      );
}
