import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/auth/error_messages.dart';
import 'package:mobile/i18n/auth_th.dart';

void main() {
  group('signupErrorMessage', () {
    test('EMAIL_INVALID', () {
      expect(signupErrorMessage('EMAIL_INVALID'), AuthTh.signupErrorEmailInvalid);
    });

    test('PASSWORD_TOO_SHORT', () {
      expect(signupErrorMessage('PASSWORD_TOO_SHORT'), AuthTh.signupErrorPasswordTooShort);
    });

    test('PASSWORD_TOO_LONG maps to the same copy as PASSWORD_TOO_SHORT', () {
      expect(signupErrorMessage('PASSWORD_TOO_LONG'), AuthTh.signupErrorPasswordTooShort);
    });

    test('PASSWORD_BREACHED', () {
      expect(signupErrorMessage('PASSWORD_BREACHED'), AuthTh.signupErrorPasswordBreached);
    });

    test('EMAIL_TAKEN', () {
      expect(signupErrorMessage('EMAIL_TAKEN'), AuthTh.signupErrorEmailTaken);
    });

    test('unknown/unmapped code falls back to generic — never renders raw code', () {
      expect(signupErrorMessage('SOME_UNEXPECTED_CODE'), AuthTh.signupErrorGeneric);
    });

    test('null code falls back to generic', () {
      expect(signupErrorMessage(null), AuthTh.signupErrorGeneric);
    });
  });

  group('loginErrorMessage — enumeration-safe (D-005/arch §9)', () {
    test('always returns the identical generic copy regardless of code', () {
      expect(loginErrorMessage('INVALID_CREDENTIALS'), AuthTh.loginErrorInvalidCredentials);
      expect(loginErrorMessage('SOME_OTHER_CODE'), AuthTh.loginErrorInvalidCredentials);
      expect(loginErrorMessage(null), AuthTh.loginErrorInvalidCredentials);
    });
  });

  group('changePasswordErrorMessage', () {
    test('INVALID_CREDENTIALS -> invalidCurrent (NOT the enumeration-safe login copy)', () {
      expect(changePasswordErrorMessage('INVALID_CREDENTIALS'), AuthTh.changePasswordErrorInvalidCurrent);
    });

    test('PASSWORD_TOO_SHORT', () {
      expect(changePasswordErrorMessage('PASSWORD_TOO_SHORT'), AuthTh.changePasswordErrorPasswordTooShort);
    });

    test('PASSWORD_BREACHED', () {
      expect(changePasswordErrorMessage('PASSWORD_BREACHED'), AuthTh.changePasswordErrorPasswordBreached);
    });

    test('unknown code falls back to generic', () {
      expect(changePasswordErrorMessage('WHATEVER'), AuthTh.changePasswordErrorGeneric);
    });
  });
}
