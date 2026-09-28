import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/features/org/presentation/copy/role_action_blocked_copy.dart';

/// T-003-M03 — ux-wireframe §0.3 (ข). Expected strings are hardcoded — a
/// copy regression must fail this test, not just a wiring regression.
void main() {
  final t = AppLocalizationsTh();

  group('roleAssignBlockedCopy (RoleRow.assignBlockedReason)', () {
    test('owner_only', () {
      expect(roleAssignBlockedCopy(t, 'owner_only'), 'เฉพาะเจ้าของร้านเท่านั้นที่ตั้งเจ้าของร้านคนใหม่ได้');
    });

    test('exceeds_your_permissions', () {
      expect(roleAssignBlockedCopy(t, 'exceeds_your_permissions'), 'บทบาทนี้มีสิทธิ์ที่คุณไม่มี จึงมอบให้คนอื่นไม่ได้');
    });

    test('unrecognized falls back, never a raw key', () {
      expect(roleAssignBlockedCopy(t, 'something_new'), 'คุณมอบบทบาทนี้ไม่ได้');
    });
  });

  group('memberManageBlockedCopy (MemberRow.manageBlockedReason)', () {
    test('owner_only', () {
      expect(
        memberManageBlockedCopy(t, 'owner_only'),
        'เฉพาะเจ้าของร้านเท่านั้นที่เปลี่ยนบทบาทหรือถอดเจ้าของร้านคนอื่นได้',
      );
    });

    test('equal_permissions', () {
      expect(
        memberManageBlockedCopy(t, 'equal_permissions'),
        'คนนี้มีสิทธิ์เท่ากับคุณ — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก',
      );
    });

    test('exceeds_your_permissions', () {
      expect(
        memberManageBlockedCopy(t, 'exceeds_your_permissions'),
        'คนนี้มีสิทธิ์บางอย่างที่คุณไม่มี — ให้เจ้าของร้านเปลี่ยนบทบาทหรือถอดออก',
      );
    });

    test('unrecognized falls back, never a raw key', () {
      expect(memberManageBlockedCopy(t, 'something_new'), 'คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย');
    });
  });

  group('invitationManageBlockedCopy (Invitation.manageBlockedReason)', () {
    test('owner_only', () {
      expect(
        invitationManageBlockedCopy(t, 'owner_only'),
        'เฉพาะเจ้าของร้านเท่านั้นที่ยกเลิกหรือออกลิงก์ใหม่ให้คำเชิญเจ้าของร้านได้',
      );
    });

    test('exceeds_your_permissions', () {
      expect(
        invitationManageBlockedCopy(t, 'exceeds_your_permissions'),
        'คำเชิญนี้ให้บทบาทที่มีสิทธิ์ที่คุณไม่มี — ให้เจ้าของร้านยกเลิกหรือออกลิงก์ใหม่',
      );
    });

    test('unrecognized falls back, never a raw key', () {
      expect(invitationManageBlockedCopy(t, 'something_new'), 'คุณจัดการคำเชิญนี้ไม่ได้ — ให้เจ้าของร้านช่วย');
    });
  });
}
