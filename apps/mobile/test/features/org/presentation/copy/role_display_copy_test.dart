import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/features/org/presentation/copy/role_display_copy.dart';

/// T-003-M03 — ux-wireframe §0.2. Expected strings are hardcoded (not read
/// back via `t.xxx`) so a copy regression fails this test, not just a
/// wiring regression (same discipline as `error_messages_test.dart`).
void main() {
  final t = AppLocalizationsTh();

  group('roleDisplayName', () {
    test('nameCustomized=true always wins, even for a system roleKey', () {
      expect(
        roleDisplayName(t, roleKey: 'admin', name: 'ผู้ช่วยเจ้าของร้าน', nameCustomized: true),
        'ผู้ช่วยเจ้าของร้าน',
      );
    });

    test('nameCustomized=false translates by roleKey', () {
      expect(roleDisplayName(t, roleKey: 'owner', name: 'เจ้าของร้าน', nameCustomized: false), 'เจ้าของร้าน');
    });

    test('nameCustomized absent (older server) falls back to the same roleKey rule', () {
      expect(roleDisplayName(t, roleKey: 'staff', name: 'พนักงาน'), 'พนักงาน');
    });

    test('unknown/custom roleKey (even nameCustomized=false) falls back to the server name', () {
      expect(
        roleDisplayName(t, roleKey: null, name: 'บัญชีภายนอก', nameCustomized: false),
        'บัญชีภายนอก',
      );
    });
  });

  group('roleUsageLine', () {
    test('0 members — ignores isMine', () {
      expect(roleUsageLine(t, activeMembers: 0, isMine: true), 'ยังไม่มีสมาชิกใช้');
    });

    test('members, not mine', () {
      expect(roleUsageLine(t, activeMembers: 3, isMine: false), 'สมาชิก 3 คน');
    });

    test('members, mine — appends the inclusion suffix', () {
      expect(roleUsageLine(t, activeMembers: 1, isMine: true), 'สมาชิก 1 คน (รวมคุณ)');
    });
  });

  group('rolePendingInvitationsSuffix', () {
    test('0 -> null (nothing rendered)', () {
      expect(rolePendingInvitationsSuffix(t, 0), null);
    });

    test('negative (malformed payload) -> null, never a negative count', () {
      expect(rolePendingInvitationsSuffix(t, -1), null);
    });

    test('> 0 -> the suffix', () {
      expect(rolePendingInvitationsSuffix(t, 1), ' · คำเชิญที่ยังไม่ปิด 1 ใบ');
    });
  });

  group('roleLastEditedLine', () {
    final at = DateTime.utc(2026, 6, 23, 7, 30); // 14:30 Bangkok

    test('null (RoleDetail.lastEdited absent) -> system default', () {
      expect(roleLastEditedLine(t, null), 'ค่าเริ่มต้นของระบบ');
    });

    test('kind=me', () {
      expect(roleLastEditedLine(t, RoleLastEditedByMe(at)), 'แก้ไขล่าสุดโดยคุณ · 23 มิ.ย. 2026, 14:30');
    });

    test('kind=member with a roleName — quoted so it does not read as a person', () {
      expect(
        roleLastEditedLine(t, RoleLastEditedByMember(at, roleName: 'แพ็คของ')),
        'แก้ไขล่าสุดโดยคนในบทบาท "แพ็คของ" · 23 มิ.ย. 2026, 14:30',
      );
    });

    test('kind=member WITHOUT a roleName — falls back to the unknown-kind line, not "โดย null"', () {
      expect(roleLastEditedLine(t, RoleLastEditedByMember(at)), 'แก้ไขล่าสุด · 23 มิ.ย. 2026, 14:30');
    });

    test('kind=former_member', () {
      expect(roleLastEditedLine(t, RoleLastEditedByFormerMember(at)), 'แก้ไขล่าสุดโดยอดีตสมาชิก · 23 มิ.ย. 2026, 14:30');
    });

    test('unrecognized kind — drops the "โดย…" clause, does not print the raw key', () {
      expect(roleLastEditedLine(t, RoleLastEditedUnknownKind(at)), 'แก้ไขล่าสุด · 23 มิ.ย. 2026, 14:30');
    });
  });
}
