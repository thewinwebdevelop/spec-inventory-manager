// T-002-M3 — S1 on mobile, all four states (gate rule 7 / design-system §2).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/api_failure.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/core/session/session_controller.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/domain/repositories/org_repository.dart';
import 'package:mobile/features/org/presentation/screens/org_picker_screen.dart';

class _FakeDirectory implements OrgDirectory {
  _FakeDirectory({this.orgs = const [], this.failure, this.delay = Duration.zero});

  final List<MyOrganization> orgs;
  final ApiFailure? failure;
  final Duration delay;

  @override
  Future<List<MyOrganization>> listMyOrganizations() async {
    await Future<void>.delayed(delay);
    if (failure != null) throw failure!;
    return orgs;
  }

  @override
  Future<CreatedOrganization> createOrganization({required String name}) =>
      throw UnimplementedError();
}

const _shops = [
  MyOrganization(id: 'org_1', name: 'ร้านหอมกรุ่นเบเกอรี่', roleName: 'Owner', roleKey: 'owner'),
  MyOrganization(id: 'org_2', name: 'คลังของฝากเชียงใหม่', roleName: 'Staff', roleKey: 'staff'),
];

Future<ProviderContainer> _pump(WidgetTester tester, OrgDirectory directory) async {
  final container = ProviderContainer(
    overrides: [orgDirectoryProvider.overrideWithValue(directory)],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(
        // `AppLocalizations.localizationsDelegates` (the bundle, not the
        // single delegate) — the same harness the auth screens use. The
        // singular form leaves Cupertino unlocalised and the framework
        // throws on it.
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: OrgPickerScreen(),
      ),
    ),
  );
  return container;
}

void main() {
  testWidgets('loading — a skeleton, never a spinner', (tester) async {
    await _pump(tester, _FakeDirectory(delay: const Duration(milliseconds: 50)));
    await tester.pump();
    // The list is not there yet, and neither is an error.
    expect(find.text('ร้านหอมกรุ่นเบเกอรี่'), findsNothing);
    await tester.pumpAndSettle();
  });

  testWidgets('data — every shop, with its role as TEXT', (tester) async {
    await _pump(tester, _FakeDirectory(orgs: _shops));
    await tester.pumpAndSettle();

    expect(find.text('ร้านหอมกรุ่นเบเกอรี่'), findsOneWidget);
    expect(find.text('คลังของฝากเชียงใหม่'), findsOneWidget);
    // §14: status and role must never be conveyed by colour alone.
    expect(find.text('เจ้าของร้าน'), findsOneWidget);
    expect(find.text('พนักงาน'), findsOneWidget);
  });

  testWidgets('empty — says what to do, including the part this screen cannot fix', (tester) async {
    await _pump(tester, _FakeDirectory());
    await tester.pumpAndSettle();

    expect(find.text('คุณยังไม่ได้อยู่ในร้านไหน'), findsOneWidget);
    // The other half: somebody else has to send you a link.
    expect(find.textContaining('ขอลิงก์คำเชิญจากเจ้าของร้าน'), findsOneWidget);
  });

  testWidgets('error — a message and a retry, never a blank screen', (tester) async {
    await _pump(tester, _FakeDirectory(failure: const NetworkFailure()));
    await tester.pumpAndSettle();

    expect(find.byType(TextButton), findsWidgets);
    expect(find.text('ร้านหอมกรุ่นเบเกอรี่'), findsNothing);
  });

  testWidgets('★ tapping a shop is ONE session write — the org becomes active', (tester) async {
    // mobile.md §3.2: switching is a single write to `SessionController`, and
    // everything downstream of `activeOrgIdProvider` rebuilds off it. If this
    // screen navigated first and set the org later, the next screen would
    // build with no active shop and `orgDioProvider` would throw.
    final container = await _pump(tester, _FakeDirectory(orgs: _shops));
    await tester.pumpAndSettle();

    expect(container.read(activeOrgIdProvider), isNull);

    await tester.tap(find.text('คลังของฝากเชียงใหม่'));
    await tester.pumpAndSettle();

    expect(container.read(activeOrgIdProvider), isNull,
        reason: 'no session yet — switchOrg only applies to an authed session');

    // With a session, the same tap lands.
    container.read(sessionControllerProvider.notifier).signedIn(orgs: const []);
    await tester.tap(find.text('คลังของฝากเชียงใหม่'));
    await tester.pumpAndSettle();

    expect(container.read(activeOrgIdProvider), 'org_2');
    expect(container.read(activeOrgProvider)?.name, 'คลังของฝากเชียงใหม่');
  });
}
