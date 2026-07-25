import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/domain/validation.dart';

void main() {
  group('isValidEmailShape', () {
    test('accepts a plausible email', () {
      expect(isValidEmailShape('somchai@shop.com'), isTrue);
    });

    test('trims surrounding whitespace before checking', () {
      expect(isValidEmailShape('  somchai@shop.com  '), isTrue);
    });

    test('rejects missing @', () {
      expect(isValidEmailShape('somchai-shop.com'), isFalse);
    });

    test('rejects missing domain dot', () {
      expect(isValidEmailShape('somchai@shop'), isFalse);
    });

    test('rejects embedded whitespace', () {
      expect(isValidEmailShape('som chai@shop.com'), isFalse);
    });

    test('rejects empty string', () {
      expect(isValidEmailShape(''), isFalse);
    });
  });

  group('isPasswordLongEnough', () {
    test('rejects fewer than 8 characters', () {
      expect(isPasswordLongEnough('short12'), isFalse);
    });

    test('accepts exactly 8 characters (boundary)', () {
      expect(isPasswordLongEnough('12345678'), isTrue);
    });

    test('accepts more than 8 characters', () {
      expect(isPasswordLongEnough('a-much-longer-passphrase'), isTrue);
    });

    test('rejects empty string', () {
      expect(isPasswordLongEnough(''), isFalse);
    });
  });
}
