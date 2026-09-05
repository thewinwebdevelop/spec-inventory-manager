import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/l10n/l10n.dart';
import '../core/session/capabilities.dart';
import '../core/session/session_state.dart';
import '../features/auth/application/auth_providers.dart';
import '../features/auth/presentation/screens/security_screen.dart';
import '../features/org/presentation/screens/create_org_screen.dart';
import '../features/org/presentation/screens/members_screen.dart';
import '../features/org/presentation/screens/org_profile_screen.dart';

/// ★ B-18 — the TEMPORARY way into F-002's screens, until F-006 builds the
/// real navigation.
///
/// What this replaces: nothing. `OrgProfileScreen`, `MembersScreen`,
/// `OrgPickerScreen` and `CreateOrgScreen` had ZERO references anywhere in
/// `lib/` outside their own definition files, and `app.dart` sent every
/// signed-in person to F-001's `SecurityScreen` and stopped there. The screens
/// worked — E-10 drives two of them against a real API every CI run — and
/// nobody could open them. The §12.2 manual pass could not run M-07 at all.
///
/// ⚠️ SCOPE, deliberately narrow. `app/app.dart` says in its own comment that
/// "F-006 owns real navigation/IA (`app/router.dart`)", and product chose to
/// unblock M-07 now rather than wait. So this is the smallest shell that makes
/// every F-002 screen reachable and nothing more: no deep links, no route
/// names, no history. F-006 should delete this file, not extend it.
///
/// Two decisions here are NOT arbitrary and must survive whoever rebuilds it:
///
///  1. **The body builds ONLY the selected screen** — no `IndexedStack`, no
///     `AutomaticKeepAlive`. Leaving a tab DISPOSES it, and that is the whole
///     security model of the tax card: the revealed national ID lives in
///     `_OrgProfileScreenState`, so "leaving forgets it" is a fact about
///     storage rather than a rule somebody has to remember (B-12). An
///     `IndexedStack` would keep that State alive and quietly reintroduce the
///     Critical the M-07 security review closed.
///  2. **The members tab is HIDDEN, not disabled**, when the member may not
///     manage members — ux-wireframe §4 answers Q13 explicitly, and the web
///     shell does the same. Hiding is a UX choice, never enforcement: the
///     server refuses regardless (architecture §3.1).
class ShopShell extends ConsumerStatefulWidget {
  const ShopShell({super.key, required this.active, required this.onSignedOut});

  final ActiveOrg active;

  /// Fired when the person signs out from the security tab.
  final VoidCallback onSignedOut;

  @override
  ConsumerState<ShopShell> createState() => _ShopShellState();
}

class _ShopShellState extends ConsumerState<ShopShell> {
  var _index = 0;
  var _signingOut = false;

  /// Ends THIS session only — `logoutDevice()` with no `familyId`.
  ///
  /// ⛔ Stays put and says so when the call fails, rather than routing away.
  /// The repository clears local token state only after the server has
  /// answered, so a failed sign-out leaves the session fully alive; dropping
  /// the person back on the login screen would show them a sign-out that did
  /// not happen. Same rule as the web shell.
  Future<void> _signOut() async {
    if (_signingOut) return;
    setState(() => _signingOut = true);
    final t = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(authRepositoryProvider).logoutDevice();
      if (!mounted) return;
      widget.onSignedOut();
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(t.navSignOutFailed)));
    } finally {
      if (mounted) setState(() => _signingOut = false);
    }
  }

  /// §13: creating a shop is a full-screen route on mobile, always.
  void _createOrganization() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (routeContext) => CreateOrgScreen(
          // The new shop is ACTIVE by the time this fires (the controller
          // writes the session), so the only thing left is to close the form —
          // the shell is already showing the new shop underneath.
          onCreated: (_) => Navigator.of(routeContext).pop(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    // ⛔ `can`, never `contains`: `full_access` is a WILDCARD, and reading it
    // as set membership is what once hid the members menu from the one person
    // who may do anything (B-1, on both clients).
    final canManageMembers = widget.active.can(manageMembersCapability);

    final destinations = <(Widget screen, NavigationDestination tab)>[
      (
        OrgProfileScreen(onCreateOrganization: _createOrganization),
        NavigationDestination(
          icon: const Icon(Icons.storefront_outlined),
          selectedIcon: const Icon(Icons.storefront),
          label: t.orgProfileTitle,
        ),
      ),
      if (canManageMembers)
        (
          const MembersScreen(),
          NavigationDestination(
            icon: const Icon(Icons.group_outlined),
            selectedIcon: const Icon(Icons.group),
            label: t.membersTitle,
          ),
        ),
      (
        SecurityScreen(
          onSessionExpired: widget.onSignedOut,
          appBarActions: [
            IconButton(
              // An icon alone never carries meaning (ux-wireframe §14) — the
              // tooltip IS the accessible name here.
              tooltip: t.navSignOut,
              onPressed: _signingOut ? null : _signOut,
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        NavigationDestination(
          icon: const Icon(Icons.lock_outline),
          selectedIcon: const Icon(Icons.lock),
          label: t.navShopSecurity,
        ),
      ),
    ];

    // The members tab appears and disappears as capabilities are learned
    // (`enterOrganization` fetches them AFTER entering, on purpose), so the
    // selected index can outlive the tab it pointed at.
    final index = _index.clamp(0, destinations.length - 1);

    return Scaffold(
      // No AppBar of its own: every screen below already owns a `Scaffold`
      // with the AppBar ux-wireframe §13 specifies for it (the shop switcher
      // lives in the shop screen's AppBar title, "แตะชื่อร้านบน AppBar →
      // bottom sheet"). A shell AppBar would stack a second bar on top of it.
      body: destinations[index].$1,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (next) => setState(() => _index = next),
        destinations: [for (final d in destinations) d.$2],
      ),
    );
  }
}
