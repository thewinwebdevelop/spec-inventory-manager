import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/error_messages.dart';
import 'package:mobile/core/l10n/l10n.dart';

/// R3/R4 — `signupErrorMessage`/etc. now take an `AppLocalizations` (the
/// ARB-backed copy source, R4) instead of reading the deleted `AuthTh` const
/// class directly. Expected values below are the SAME literal Thai strings
/// `AuthTh` used to hold (now `lib/l10n/app_th.arb`'s `authSignup*`/
/// `authLogin*`/`authChangePassword*` keys) — hardcoded here (not read back
/// via `t.xxx`) so this test still catches a copy regression, not just a
/// wiring regression.
void main() {
  final t = AppLocalizationsTh();

  group('signupErrorMessage', () {
    test('EMAIL_INVALID', () {
      expect(signupErrorMessage(t, 'EMAIL_INVALID'), 'รูปแบบอีเมลไม่ถูกต้อง');
    });

    test('PASSWORD_TOO_SHORT', () {
      expect(signupErrorMessage(t, 'PASSWORD_TOO_SHORT'), 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร');
    });

    test('PASSWORD_TOO_LONG maps to the same copy as PASSWORD_TOO_SHORT', () {
      expect(signupErrorMessage(t, 'PASSWORD_TOO_LONG'), 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร');
    });

    test('PASSWORD_BREACHED', () {
      expect(signupErrorMessage(t, 'PASSWORD_BREACHED'),
          'รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น');
    });

    test('EMAIL_TAKEN', () {
      expect(signupErrorMessage(t, 'EMAIL_TAKEN'), 'อีเมลนี้มีผู้ใช้งานแล้ว');
    });

    test('unknown/unmapped code falls back to generic — never renders raw code', () {
      expect(signupErrorMessage(t, 'SOME_UNEXPECTED_CODE'), 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });

    test('null code falls back to generic', () {
      expect(signupErrorMessage(t, null), 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });

  group('loginErrorMessage — enumeration-safe (D-005/arch §9)', () {
    test('always returns the identical generic copy regardless of code', () {
      expect(loginErrorMessage(t, 'INVALID_CREDENTIALS'), 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      expect(loginErrorMessage(t, 'SOME_OTHER_CODE'), 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      expect(loginErrorMessage(t, null), 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    });
  });

  group('changePasswordErrorMessage', () {
    test('INVALID_CREDENTIALS -> invalidCurrent (NOT the enumeration-safe login copy)', () {
      expect(changePasswordErrorMessage(t, 'INVALID_CREDENTIALS'), 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    });

    test('PASSWORD_TOO_SHORT', () {
      expect(changePasswordErrorMessage(t, 'PASSWORD_TOO_SHORT'), 'รหัสผ่านสั้นเกินไป ต้องมีอย่างน้อย 8 ตัวอักษร');
    });

    test('PASSWORD_BREACHED', () {
      expect(changePasswordErrorMessage(t, 'PASSWORD_BREACHED'),
          'รหัสผ่านนี้ถูกใช้งานทั่วไปมาก ไม่ปลอดภัย ลองตั้งรหัสผ่านที่คาดเดายากขึ้น');
    });

    test('unknown code falls back to generic', () {
      expect(changePasswordErrorMessage(t, 'WHATEVER'), 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}
