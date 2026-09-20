import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/shop_shell.dart';
import 'package:mobile/core/session/session_state.dart';
import 'package:mobile/features/auth/application/auth_providers.dart';
import 'package:mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/org/application/org_providers.dart';
import 'package:mobile/features/org/domain/entities/org_entities.dart';
import 'package:mobile/features/org/presentation/screens/members_screen.dart';
import 'package:mobile/features/org/presentation/screens/org_profile_screen.dart';

import '../features/org/harness.dart';
import '../features/org/org_fakes.dart';

/// ★ B-18 — the temporary shell that finally makes F-002's screens reachable.
///
/// These are not tests of a nav bar. Each one pins a decision that, if a later
/// router quietly reverses it, puts back a defect this project has already
/// paid for once.
class _FakeAuth implements AuthRepository {
  _FakeAuth({this.fails = false});

  final bool fails;
  var logoutDeviceCalls = 0;
  var logoutAllCalls = 0;
  String? lastFamilyId;

  @override
  Future<void> logoutDevice({String? familyId}) async {
    logoutDeviceCalls++;
    lastFamilyId = familyId;
    if (fails) throw Exception('network');
  }

  @override
  Future<void> logoutAll() async => logoutAllCalls++;

  /// Everything else is out of scope here and says so loudly rather than
  /// returning a quiet default.
  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnimplementedError('${invocation.memberName} is not part of this test');
}

/// An Owner as the SERVER describes one: the wildcard and nothing else.
const _ownerWildcardOnly = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {'full_access'},
);

/// A member who may not manage members.
const _staffOrg = ActiveOrg(
  orgId: 'org_1',
  name: 'ร้านหอมกรุ่นเบเกอรี่',
  capabilities: {},
);

Future<_FakeAuth> _pumpShell(
  WidgetTester tester, {
  required ActiveOrg active,
  bool authFails = false,
  VoidCallback? onSignedOut,
}) async {
  final auth = _FakeAuth(fails: authFails);
  await pumpScreen(
    tester,
    ShopShell(active: active, onSignedOut: onSignedOut ?? () {}),
    overrides: [
      orgScopedRepositoryProvider.overrideWithValue(
        FakeOrgScoped(memberPages: [PagedResult(items: [member(id: 'usr_1', isMe: true)])]),
      ),
      authRepositoryProvider.overrideWithValue(auth),
    ],
    activeOrg: active,
  );
  await tester.pumpAndSettle();
  return auth;
}

void main() {
  testWidgets('★ an Owner carrying ONLY `full_access` is offered the members tab',
      (tester) async {
    // `full_access` is a WILDCARD, not a member of the set. Reading it as set
    // membership is B-1, which cost the Owner their own members menu on both
    // clients — and a nav bar is exactly where that mistake reappears.
    await _pumpShell(tester, active: _ownerWildcardOnly);

    expect(find.widgetWithText(NavigationBar, 'สมาชิก'), findsOneWidget);
  });

  testWidgets('a member without `manage_members` is not offered it at all', (tester) async {
    // ux-wireframe §4 answers Q13 explicitly: HIDE, do not disable — a
    // disabled entry raises a question the person cannot resolve. This is UX,
    // never enforcement; the server refuses regardless.
    await _pumpShell(tester, active: _staffOrg);

    expect(find.widgetWithText(NavigationBar, 'สมาชิก'), findsNothing);
    expect(find.widgetWithText(NavigationBar, 'ข้อมูลร้าน'), findsOneWidget);
  });

  testWidgets('★★ leaving the shop tab DISPOSES it — the revealed tax id cannot outlive it',
      (tester) async {
    // The whole security model of the tax card is that the number lives in
    // `_OrgProfileScreenState`, so "leaving forgets it" is a fact about
    // storage rather than a rule somebody has to remember (B-12: the reveal
    // once survived the screen, the shop AND the session). An `IndexedStack`
    // — the obvious way to build a tab shell — keeps that State alive and
    // silently restores the Critical the M-07 review closed.
    await _pumpShell(tester, active: _ownerWildcardOnly);
    final shopTab = tester.state(find.byType(OrgProfileScreen));
    expect(shopTab.mounted, isTrue);

    await tester.tap(find.text('ความปลอดภัย'));
    await tester.pumpAndSettle();

    // ⛔ `mounted`, NOT `find.byType(...) → findsNothing`. The first draft of
    // this test asserted the latter and PASSED against an `IndexedStack`,
    // because a stacked child is still in the tree — only unpainted. It would
    // have reported "disposed" over a screen still holding the number. The
    // claim is about the State's lifetime, so this is what has to be read.
    expect(shopTab.mounted, isFalse);
  });

  testWidgets('switching tabs and back rebuilds the screen from scratch', (tester) async {
    // The other half of the same rule: coming back must be a NEW screen, not
    // the old one revealed again.
    await _pumpShell(tester, active: _ownerWildcardOnly);
    final first = tester.state(find.byType(OrgProfileScreen));

    await tester.tap(find.text('ความปลอดภัย'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ข้อมูลร้าน'));
    await tester.pumpAndSettle();

    expect(tester.state(find.byType(OrgProfileScreen)), isNot(same(first)));
  });

  testWidgets('the members tab shows the members screen', (tester) async {
    // Sanity that the shell wires the destination it advertises — this is the
    // screen that had no caller anywhere in `lib/`.
    await _pumpShell(tester, active: _ownerWildcardOnly);

    await tester.tap(find.text('สมาชิก'));
    await tester.pumpAndSettle();

    expect(find.byType(MembersScreen), findsOneWidget);
  });

  testWidgets('★ signing out ends THIS session — not every device the person owns',
      (tester) async {
    // Before this control existed, mobile's only way out was
    // "ออกจากระบบทุกอุปกรณ์", which is an answer to a different question. The
    // session list deliberately gives the CURRENT device no button of its own
    // (ux-wireframe §4, F-001) because the main menu was supposed to carry it.
    var signedOut = false;
    final auth = await _pumpShell(
      tester,
      active: _ownerWildcardOnly,
      onSignedOut: () => signedOut = true,
    );

    await tester.tap(find.text('ความปลอดภัย'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('ออกจากระบบ'));
    await tester.pumpAndSettle();

    expect(auth.logoutDeviceCalls, 1);
    expect(auth.lastFamilyId, isNull, reason: 'this device, chosen by omission');
    expect(auth.logoutAllCalls, 0);
    expect(signedOut, isTrue);
  });

  testWidgets('★ a FAILED sign-out stays put and says so — it does not fake success',
      (tester) async {
    // The repository clears local token state only after the server answers,
    // so a failed call leaves the session fully alive. Reporting success would
    // show somebody a sign-out that did not happen.
    var signedOut = false;
    await _pumpShell(
      tester,
      active: _ownerWildcardOnly,
      authFails: true,
      onSignedOut: () => signedOut = true,
    );

    await tester.tap(find.text('ความปลอดภัย'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('ออกจากระบบ'));
    await tester.pump();

    expect(signedOut, isFalse);
    expect(find.text('ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง'), findsOneWidget);
  });
}
