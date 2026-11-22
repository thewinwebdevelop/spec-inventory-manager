// T-003-M08 — the §E copy R3's save and R5's delete share, and R5 (ข)'s count
// line (§0.2 with the zero parts dropped).
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/features/org/application/role_write_error.dart';
import 'package:mobile/features/org/domain/entities/role_entities.dart';
import 'package:mobile/features/org/presentation/copy/role_write_error_copy.dart';

void main() {
  final AppLocalizations t = AppLocalizationsTh();

  group('roleBannerProblemCopy', () {
    test('generic: the SAVE sentence on R3, the DELETE sentence on R5', () {
      expect(roleBannerProblemCopy(t, RoleBannerProblem.generic), 'บันทึกบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      expect(roleBannerProblemCopy(t, RoleBannerProblem.generic, deleting: true),
          'ลบบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });

    test('a shared refusal reads the same either way', () {
      for (final p in [RoleBannerProblem.targetNotBelowActor, RoleBannerProblem.busy, RoleBannerProblem.roleLocked]) {
        expect(roleBannerProblemCopy(t, p, deleting: true), roleBannerProblemCopy(t, p), reason: '$p');
      }
      expect(roleBannerProblemCopy(t, RoleBannerProblem.heldRequiresManageMembers),
          t.roleReasonInUseRequiresManageMembersBody);
    });

    test('role limit: with the number when it is known, the no-number sentence when not', () {
      expect(roleBannerProblemCopy(t, RoleBannerProblem.roleLimitReached, limit: 30), t.roleLimitReachedWithLimitBody(30));
      expect(roleBannerProblemCopy(t, RoleBannerProblem.roleLimitReached), t.roleLimitReachedUnknownLimitBody);
    });
  });

  group('roleInUseCountLine', () {
    test('both parts, joined with " · "', () {
      expect(roleInUseCountLine(t, const RoleUsage(activeMembers: 2, pendingInvitations: 1), isMine: false),
          'สมาชิก 2 คน · คำเชิญที่ยังไม่ปิด 1 ใบ');
    });

    test('zero parts are dropped; both zero → empty', () {
      expect(roleInUseCountLine(t, const RoleUsage(activeMembers: 0, pendingInvitations: 3), isMine: false),
          'คำเชิญที่ยังไม่ปิด 3 ใบ');
      expect(roleInUseCountLine(t, const RoleUsage(activeMembers: 4, pendingInvitations: 0), isMine: false),
          'สมาชิก 4 คน');
      expect(roleInUseCountLine(t, const RoleUsage(activeMembers: 0, pendingInvitations: 0), isMine: false), '');
    });

    test('my own role → "(รวมคุณ)" on the members part', () {
      expect(roleInUseCountLine(t, const RoleUsage(activeMembers: 1, pendingInvitations: 0), isMine: true),
          'สมาชิก 1 คน (รวมคุณ)');
    });
  });
}
