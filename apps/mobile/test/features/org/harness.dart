import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/core/session/session_state.dart';

/// Pumps a screen the way the app builds it.
///
/// `AppLocalizations.localizationsDelegates` — the BUNDLE, not the single
/// delegate: the singular form leaves Cupertino unlocalised and the framework
/// throws on it (learned the hard way in the auth widget tests).
Future<ProviderContainer> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  List<Override> overrides = const [],
  ActiveOrg? activeOrg,
  bool signedIn = true,
}) async {
  final container = ProviderContainer(overrides: overrides);
  addTearDown(container.dispose);
  if (signedIn) {
    container
        .read(sessionControllerProvider.notifier)
        .signedIn(orgs: const [], active: activeOrg);
  }

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: screen,
      ),
    ),
  );
  return container;
}

const ownerOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'full_access', 'manage_members'},
);

const adminOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  // No `full_access` — an Admin. The distinction the Owner-only rule turns
  // on (D-028/C-1), and never a role name.
  capabilities: {'manage_members'},
);
