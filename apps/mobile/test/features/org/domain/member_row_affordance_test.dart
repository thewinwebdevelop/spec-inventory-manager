// T-003-M10 ★ — R7: what a member row offers is the SERVER's verdict, read
// as-is (api-spec §3.1 · test-plan CM3-03). Nothing here may look at a role
// key, a capability, or `isOwner` — only `viewerCanManage`/`manageBlockedReason`.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/member_row_affordance.dart';

import '../org_fakes.dart';

void main() {
  test('viewerCanManage=true → manageable', () {
    expect(memberRowAffordance(member(viewerCanManage: true)), isA<MemberRowManageable>());
  });

  test('viewerCanManage=false → locked, carrying the server reason verbatim', () {
    for (final reason in [
      'owner_only',
      'equal_permissions',
      'exceeds_your_permissions',
      'brand_new_reason',
    ]) {
      final a = memberRowAffordance(member(viewerCanManage: false, manageBlockedReason: reason));
      expect(a, isA<MemberRowLocked>());
      expect((a as MemberRowLocked).reason, reason);
    }
  });

  test('viewerCanManage=false with no reason → locked, reason unknown (generic copy)', () {
    final a = memberRowAffordance(member(viewerCanManage: false));
    expect(a, isA<MemberRowLocked>());
    expect((a as MemberRowLocked).reason, isNull);
  });

  test('★ verdict ABSENT → no action, whoever the row is', () {
    // F-002 mobile had no member actions at all: absent = not offered.
    expect(memberRowAffordance(member()), isA<MemberRowNoAction>());
    expect(memberRowAffordance(member(isMe: true)), isA<MemberRowNoAction>());
    expect(memberRowAffordance(member(isOwner: true, roleKey: 'owner')), isA<MemberRowNoAction>());
  });

  test('★ the verdict alone decides — isOwner / roleKey never move it', () {
    expect(
      memberRowAffordance(member(isOwner: true, roleKey: 'owner', viewerCanManage: true)),
      isA<MemberRowManageable>(),
    );
    expect(
      memberRowAffordance(
        member(roleKey: 'staff', viewerCanManage: false, manageBlockedReason: 'equal_permissions'),
      ),
      isA<MemberRowLocked>(),
    );
  });

  test('a row that is not active offers nothing and explains nothing', () {
    expect(
      memberRowAffordance(member(status: 'revoked', viewerCanManage: true)),
      isA<MemberRowNoAction>(),
    );
    expect(
      memberRowAffordance(
        member(status: 'revoked', viewerCanManage: false, manageBlockedReason: 'owner_only'),
      ),
      isA<MemberRowNoAction>(),
    );
  });
}
