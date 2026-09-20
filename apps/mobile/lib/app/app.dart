import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/l10n/l10n.dart';
import '../core/theme/app_theme.dart';
import '../core/session/session_controller.dart';
import '../core/session/session_state.dart';
import '../features/auth/presentation/screens/bootstrap_screen.dart';
import '../features/org/presentation/screens/create_org_screen.dart';
import '../features/org/presentation/screens/org_picker_screen.dart';
import 'auth_flow.dart';
import 'shop_shell.dart';

// T-001-17 — real F-001 auth screens (signup/login/help/security), replacing
// the F-000 placeholder shell. Still proves apps/mobile consumes the
// generated OpenAPI Dart client (package:omnistock_api_client) — now via
// real typed usage throughout lib/features/auth/**
// (AuthApi, LoginRequest, TokenResponse, Session, ...), not just a single
// enum reference.
//
// F-006 integration seam (see lib/app/auth_flow.dart doc comment): this
// widget is a *standalone* runnable proof, not the final app shell — F-006
// owns real navigation/IA (`app/router.dart`) and should wire
// `authRepositoryProvider`'s override + `BootstrapScreen`/`AuthFlow`/
// `SecurityScreen` into its own bootstrap rather than depend on this
// particular `MaterialApp`.
//
// D-023: this was `main.dart`'s `OmniStockApp` before the mobile
// architecture refactor — moved to `app/app.dart` (composition root) so
// `main.dart` can be the thin `runApp(ProviderScope(child: OmniStockApp()))`
// the doc specifies.

/// ★ B-18 — the destination comes from [SessionState] now, not from a local
/// enum this widget kept to itself.
///
/// The old shape had three hard-coded stops (bootstrap → authFlow →
/// `SecurityScreen`) and never touched the session controller. Two things
/// followed from that, and both were invisible until somebody ran the app by
/// hand during the §12.2 manual pass:
///
///   · **`signedIn()` was never called by anything.** `SessionController`
///     starts at [SessionUnknown] and stayed there for the life of the
///     process. `switchOrg` returns early unless the state is already
///     [SessionAuthed] — so tapping a shop in the picker would have written
///     nothing and looked like a dead row, and `learnCapabilities` swallows
///     its errors by design, so nothing would have said a word.
///   · Every F-002 screen was unreachable: `app.dart` stopped at F-001's
///     security screen, and the picker, the create-shop form, the members
///     list and the shop profile had no caller anywhere in `lib/`.
///
/// Reading the session instead means the states the model already draws a
/// distinction between actually reach the screen: [SessionUnknown] is not
/// "signed out" (it is bootstrap still deciding), and [SessionAuthed] with
/// `active == null` is not "no session" (it is the shop picker).
///
/// F-006 replaces this with a real router; the shape it has to preserve is
/// "one source of truth for where you are", which is what this restores.
class OmniStockApp extends ConsumerStatefulWidget {
  const OmniStockApp({super.key});

  @override
  ConsumerState<OmniStockApp> createState() => _OmniStockAppState();
}

class _OmniStockAppState extends ConsumerState<OmniStockApp> {
  /// Bootstrap has to be shown until it ANSWERS, and its answer is what puts
  /// the session into a real state. Kept as a flag rather than inferred from
  /// [SessionUnknown] so a later `signedOut()` cannot rerun the cold-start
  /// gate and re-restore the session it just ended.
  var _bootstrapping = true;

  /// True while the create-shop form is open on top of the picker.
  var _creatingShop = false;

  void _signedIn() {
    // `orgs` stays empty on purpose: the picker reads
    // `myOrganizationsProvider` (`/me/organizations`) itself, and nothing in
    // the tree reads `SessionAuthed.orgs`. Duplicating the list here would be
    // a second copy to keep in sync for no reader.
    ref.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
    setState(() => _bootstrapping = false);
  }

  void _needsLogin() {
    ref.read(sessionControllerProvider.notifier).signedOut();
    setState(() {
      _bootstrapping = false;
      _creatingShop = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);

    final Widget home;
    if (_bootstrapping) {
      home = BootstrapScreen(onRestored: _signedIn, onNeedsLogin: _needsLogin);
    } else {
      switch (session) {
        // Cannot happen once bootstrap has answered — but the switch is
        // exhaustive by design (`SessionState` is sealed so a new state cannot
        // be added without every reader being asked), and falling through to
        // the login flow is the safe direction.
        case SessionUnknown():
        case SessionNone():
          home = AuthFlow(onAuthenticated: _signedIn);
        case SessionForceUpdate():
          // F-006 owns the real terminal screen for `426`; until then the
          // honest thing is to send the person back to login rather than
          // pretend the app works.
          home = AuthFlow(onAuthenticated: _signedIn);
        case SessionAuthed(active: final active?):
          home = ShopShell(active: active, onSignedOut: _needsLogin);
        case SessionAuthed():
          home = _creatingShop
              ? CreateOrgScreen(onCreated: (_) => setState(() => _creatingShop = false))
              : OrgPickerScreen(
                  onCreateOrganization: () => setState(() => _creatingShop = true),
                );
      }
    }

    return MaterialApp(
      title: 'OmniStock',
      theme: buildAppTheme(),
      darkTheme: buildAppDarkTheme(),
      themeMode: ThemeMode.system,
      // R4 (docs/architecture/refactor-plan.md §4, mobile.md §3.7) — wires
      // the generated AppLocalizations (Thai only for now, structure ready
      // for `en` later per the ARB doc comment) so every `presentation/`
      // widget's `AppLocalizations.of(context)` resolves, plus Thai
      // MaterialLocalizations (date pickers etc.) for free.
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('th'),
      home: home,
    );
  }
}
