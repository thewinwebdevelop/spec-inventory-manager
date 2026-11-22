// T-003-M10/M11 ★ — R7/R10 (ก): what a member row offers.
//
// Verdict PRESENT → the server's verdict, read as-is, both ways (CM3-03):
// nothing on this device may move it.
// Verdict ABSENT (viewer holds manage_members but not manage_roles — the
// server omits it on purpose, api-spec §3.1) → NOT fail-closed (M11): the
// F-002 rule the web W10 applies — own row tappable (D-040), an Owner row
// locked `owner_only` unless the viewer is an Owner, any other active row
// tappable and the SERVER decides on submit.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/member_row_affordance.dart';

import '../org_fakes.dart';

void main() {
  group('verdict present', () {
    test('viewerCanManage=true → manageable', () {
      expect(
        memberRowAffordance(member(viewerCanManage: true), viewerIsOwner: false),
        isA<MemberRowManageable>(),
      );
    });

    test('viewerCanManage=false → locked, carrying the server reason verbatim', () {
      for (final reason in [
        'owner_only',
        'equal_permissions',
        'exceeds_your_permissions',
        'brand_new_reason',
      ]) {
        final a = memberRowAffordance(
          member(viewerCanManage: false, manageBlockedReason: reason),
          viewerIsOwner: true,
        );
        expect(a, isA<MemberRowLocked>());
        expect((a as MemberRowLocked).reason, reason);
      }
    });

    test('viewerCanManage=false with no reason → locked, reason unknown (generic copy)', () {
      final a = memberRowAffordance(member(viewerCanManage: false), viewerIsOwner: false);
      expect(a, isA<MemberRowLocked>());
      expect((a as MemberRowLocked).reason, isNull);
    });

    test('★ the verdict alone decides — isOwner / roleKey / the viewer never move it', () {
      for (final viewerIsOwner in [true, false]) {
        expect(
          memberRowAffordance(
            member(isOwner: true, roleKey: 'owner', viewerCanManage: true),
            viewerIsOwner: viewerIsOwner,
          ),
          isA<MemberRowManageable>(),
        );
        expect(
          memberRowAffordance(
            member(roleKey: 'staff', viewerCanManage: false, manageBlockedReason: 'equal_permissions'),
            viewerIsOwner: viewerIsOwner,
          ),
          isA<MemberRowLocked>(),
        );
      }
    });
  });

  group('★ M11 — verdict ABSENT is not fail-closed', () {
    test('an ordinary active row → manageable (the server decides on submit)', () {
      expect(memberRowAffordance(member(), viewerIsOwner: false), isA<MemberRowManageable>());
    });

    test('★ D-040 — your own row → manageable', () {
      expect(memberRowAffordance(member(isMe: true), viewerIsOwner: false), isA<MemberRowManageable>());
    });

    test('★ an Owner row, viewer not an Owner → locked owner_only', () {
      final a = memberRowAffordance(member(isOwner: true, roleKey: 'owner'), viewerIsOwner: false);
      expect(a, isA<MemberRowLocked>());
      expect((a as MemberRowLocked).reason, 'owner_only');
    });

    test('an Owner row, viewer IS an Owner (older server) → manageable', () {
      expect(
        memberRowAffordance(member(isOwner: true, roleKey: 'owner'), viewerIsOwner: true),
        isA<MemberRowManageable>(),
      );
    });

    test('★ isOwner decides, never roleKey: a row keyed "owner" that is not an Owner stays open',
        () {
      expect(
        memberRowAffordance(member(roleKey: 'owner'), viewerIsOwner: false),
        isA<MemberRowManageable>(),
      );
      final a = memberRowAffordance(member(isOwner: true, roleKey: 'staff'), viewerIsOwner: false);
      expect(a, isA<MemberRowLocked>());
    });
  });

  test('a row that is not active offers nothing and explains nothing', () {
    for (final m in [
      member(status: 'revoked', viewerCanManage: true),
      member(status: 'revoked', viewerCanManage: false, manageBlockedReason: 'owner_only'),
      member(status: 'revoked'),
      member(status: 'revoked', isOwner: true),
    ]) {
      expect(memberRowAffordance(m, viewerIsOwner: false), isA<MemberRowNoAction>());
    }
  });
}
