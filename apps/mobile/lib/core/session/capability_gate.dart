/// T-003-M01 ★ — RBAC gating for entry points and screens
/// (docs/architecture/mobile.md §3.3 "Widget-level gating").
///
/// ⛔ UX gating, NOT enforcement. Every route these guard is enforced by the
/// server (F-003 api-spec: the roles routes are gated `manage_roles`), and a
/// hidden control still needs its `403` path. What this file decides is only
/// what to OFFER, and it decides it from exactly one input: the capability set
/// the server reported for the active shop (`SessionController`), read through
/// `can()` so the `full_access` wildcard holds.
///
/// Deviation from the §3.3 sketch, on purpose: the sketch reads
/// `capabilities.contains(cap)`. That is the B-1 bug — an Owner holds only
/// `full_access` — so this reads `ActiveOrg.can` instead.
///
/// RBAC only. Plan tier (entitlements, F-007) is a different question with
/// different UX (show + lock + upgrade, never hide) and does not belong here.
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_controller.dart';

export 'capabilities.dart'
    show fullAccessCapability, manageMembersCapability, manageOrgSettingsCapability,
        manageRolesCapability;

/// May the caller do [capability] in the active shop — as the server said?
///
/// Fails CLOSED: cold start, signed out, and signed in without a shop all
/// read `false`. "Nobody told us" is never a yes.
final canProvider = Provider.family<bool, String>(
  (ref, capability) => ref.watch(activeOrgProvider)?.can(capability) ?? false,
);

/// Shows [child] (an entry point: a ListRow, a tertiary button) only while
/// the caller holds [capability]; otherwise [fallback], which defaults to
/// nothing. Re-evaluates when the server's answer changes — an entry must not
/// outlive the capability behind it.
class CapabilityGate extends ConsumerWidget {
  const CapabilityGate({
    super.key,
    required this.capability,
    required this.child,
    this.fallback = const SizedBox.shrink(),
  });

  final String capability;
  final Widget child;
  final Widget fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      ref.watch(canProvider(capability)) ? child : fallback;
}

/// Wraps a whole screen that needs [capability].
///
/// While the capability holds, renders [child]. When it does not — opened
/// without it, or taken away while the screen is open (role edited, shop
/// switched) — it stops rendering [child] immediately and calls [onDenied]
/// ONCE, after the frame, so the caller can leave (typically `pop`, per
/// ux-wireframe: "ไม่ค้างบนจอที่เข้าไม่ได้"). It fires again only if the
/// capability comes back and is then lost again; a second `pop` for the same
/// loss would close the screen underneath as well.
class CapabilityScreenGuard extends ConsumerStatefulWidget {
  const CapabilityScreenGuard({
    super.key,
    required this.capability,
    required this.onDenied,
    required this.child,
  });

  final String capability;
  final VoidCallback onDenied;
  final Widget child;

  @override
  ConsumerState<CapabilityScreenGuard> createState() => _CapabilityScreenGuardState();
}

class _CapabilityScreenGuardState extends ConsumerState<CapabilityScreenGuard> {
  bool _deniedReported = false;

  /// The shop this screen was opened in. A screen's data belongs to ONE shop:
  /// switching to shop B — even one where the caller holds the same
  /// capability — must not leave shop A's roles on screen.
  late final String? _openedInOrg = ref.read(activeOrgIdProvider);

  bool _allowed({required bool watch}) {
    final can = watch
        ? ref.watch(canProvider(widget.capability))
        : ref.read(canProvider(widget.capability));
    final orgId = watch ? ref.watch(activeOrgIdProvider) : ref.read(activeOrgIdProvider);
    return can && orgId != null && orgId == _openedInOrg;
  }

  @override
  Widget build(BuildContext context) {
    if (_allowed(watch: true)) {
      _deniedReported = false;
      return widget.child;
    }
    if (!_deniedReported) {
      _deniedReported = true;
      // Never navigate during build. Re-check at call time: a denial that was
      // undone before the frame ended (e.g. the empty set a shop entry holds
      // until `capabilitiesLearned` lands) must not throw the person out. The
      // rebuild that follows the restore resets the latch.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && !_allowed(watch: false)) widget.onDenied();
      });
    }
    return const SizedBox.shrink();
  }
}
