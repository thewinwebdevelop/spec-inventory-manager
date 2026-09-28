import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/l10n/l10n.dart';
import 'package:mobile/features/org/presentation/copy/role_viewer_reason_copy.dart';

/// T-003-M03 — ux-wireframe §0.3 (ก). Expected strings are hardcoded — a
/// copy regression must fail this test, not just a wiring regression.
void main() {
  final t = AppLocalizationsTh();

  group('roleEditOrDeleteReasonBanner', () {
    test('writes_disabled', () {
      final r = roleEditOrDeleteReasonBanner(t, 'writes_disabled');
      expect(r.title, 'ยังสร้างหรือแก้บทบาทไม่ได้ในตอนนี้');
      expect(
        r.body,
        'ระบบกำลังทยอยเปิดให้ทุกร้าน ระหว่างนี้ดูรายละเอียดได้ตามปกติ และยังมอบบทบาทที่มีอยู่ให้สมาชิกได้เหมือนเดิม',
      );
    });

    test('role_locked', () {
      final r = roleEditOrDeleteReasonBanner(t, 'role_locked');
      expect(r.title, 'บทบาทเจ้าของร้านถูกล็อกไว้');
      expect(
        r.body,
        'แก้ชื่อ แก้สิทธิ์ หรือลบไม่ได้ เพื่อให้ร้านมีคนที่ทำได้ทุกอย่างอยู่เสมอ — ถ้าต้องการบทบาทที่ทำได้เกือบทุกอย่าง ให้สร้างบทบาทใหม่แล้วติ๊กสิทธิ์ที่ต้องการ',
      );
    });

    test('exceeds_your_permissions', () {
      final r = roleEditOrDeleteReasonBanner(t, 'exceeds_your_permissions');
      expect(r.title, 'ดูได้อย่างเดียว — บทบาทนี้มีสิทธิ์ที่คุณไม่มี');
      expect(r.body, 'คุณแก้ ลบ หรือทำสำเนาบทบาทที่มีสิทธิ์เกินของตัวเองไม่ได้ ถ้าต้องการเปลี่ยน ให้เจ้าของร้านแก้ให้');
    });

    test('in_use_requires_manage_members', () {
      final r = roleEditOrDeleteReasonBanner(t, 'in_use_requires_manage_members');
      expect(r.title, 'ดูได้อย่างเดียว — มีสมาชิกคนอื่นใช้บทบาทนี้อยู่');
      expect(
        r.body,
        'การแก้หรือลบบทบาทที่คนอื่นใช้อยู่ ต้องมีสิทธิ์ "จัดการสมาชิกและคำเชิญ" ด้วย ให้เจ้าของร้านแก้ หรือทำสำเนาไปปรับเป็นบทบาทใหม่',
      );
    });

    test('equal_permissions_in_use', () {
      final r = roleEditOrDeleteReasonBanner(t, 'equal_permissions_in_use');
      expect(r.title, 'ดูได้อย่างเดียว — มีคนที่สิทธิ์เท่าคุณใช้บทบาทนี้อยู่');
      expect(
        r.body,
        'บทบาทนี้มีสิทธิ์เท่ากับของคุณ และมีสมาชิกคนอื่นใช้อยู่ จึงต้องให้เจ้าของร้านเป็นคนแก้หรือลบ — หรือทำสำเนาไปปรับเป็นบทบาทใหม่',
      );
    });

    test('unrecognized reason falls back to the generic read-only copy, never a raw key', () {
      final r = roleEditOrDeleteReasonBanner(t, 'some_future_reason');
      expect(r.title, 'ดูได้อย่างเดียว');
      expect(r.body, 'ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน');
    });
  });

  group('roleDeleteOnlyReasonBanner', () {
    test('in_use', () {
      final r = roleDeleteOnlyReasonBanner(t, 'in_use');
      expect(r.title, 'ลบไม่ได้ตอนนี้ — ยังมีคนใช้บทบาทนี้อยู่');
      expect(r.body, 'ย้ายสมาชิกไปบทบาทอื่นและยกเลิกคำเชิญเหล่านี้ก่อน แล้วค่อยลบ');
    });

    test('history_limit_reached', () {
      final r = roleDeleteOnlyReasonBanner(t, 'history_limit_reached');
      expect(r.title, 'ลบเพิ่มไม่ได้');
      expect(r.body, 'ร้านนี้ลบบทบาทไปครบจำนวนที่ระบบเก็บประวัติได้แล้ว กรุณาติดต่อทีมงาน OmniStock');
    });

    test('unrecognized falls back to generic read-only copy', () {
      final r = roleDeleteOnlyReasonBanner(t, 'nope');
      expect(r.title, 'ดูได้อย่างเดียว');
    });
  });

  group('roleCreateOrCloneBlockedCopy', () {
    test('role_limit_reached WITH a limit — the number is server-supplied, never invented', () {
      expect(
        roleCreateOrCloneBlockedCopy(t, 'role_limit_reached', limit: 30),
        'ร้านนี้มีบทบาทครบ 30 บทบาทแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้',
      );
    });

    test('role_limit_reached WITHOUT a limit in hand — generic copy, no made-up number', () {
      expect(
        roleCreateOrCloneBlockedCopy(t, 'role_limit_reached'),
        'ร้านนี้มีบทบาทครบจำนวนสูงสุดแล้ว ลบบทบาทที่ไม่ใช้ก่อน จึงจะสร้างใหม่ได้',
      );
    });

    test('unrecognized reason (or owner_role, a caller bug) falls back to the generic copy', () {
      expect(roleCreateOrCloneBlockedCopy(t, 'owner_role'), 'ตอนนี้คุณทำรายการนี้กับบทบาทนี้ไม่ได้ ถ้าคิดว่าไม่ถูกต้อง ติดต่อเจ้าของร้าน');
    });
  });
}
