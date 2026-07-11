import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/domain/throttle_countdown.dart';

/// R4 — `formatThrottleMessage` no longer reads copy from `AuthTh` itself
/// (domain purity — see the function's doc comment); this test supplies the
/// SAME literal Thai copy `AuthTh.throttleBannerLong`/`throttleBannerShort`
/// used to hard-code, mirroring exactly what
/// `lib/l10n/app_th.arb`'s `authThrottleBannerLong`/`authThrottleBannerShort`
/// now hold, so every expected string below is unchanged byte-for-byte.
String _format(num remainingSeconds) => formatThrottleMessage(
      remainingSeconds,
      longForm: (mm, ss) => 'ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ $mm:$ss นาที',
      shortForm: (n) => 'รอสักครู่แล้วลองใหม่ · เหลือ $n วินาที',
    );

void main() {
  group('pad2', () {
    test('pads single digits', () {
      expect(pad2(5), '05');
    });

    test('leaves two digits unchanged', () {
      expect(pad2(42), '42');
    });
  });

  group('formatThrottleMessage', () {
    test('long form (>60s) uses mm:ss copy', () {
      // 125s -> 02:05
      expect(_format(125), 'ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ 02:05 นาที');
    });

    test('boundary exactly 60s uses short form (not long)', () {
      expect(_format(60), 'รอสักครู่แล้วลองใหม่ · เหลือ 60 วินาที');
    });

    test('boundary 61s uses long form', () {
      expect(_format(61), 'ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ 01:01 นาที');
    });

    test('short form (<=60s)', () {
      expect(_format(15), 'รอสักครู่แล้วลองใหม่ · เหลือ 15 วินาที');
    });

    test('never never renders "ล็อก"/"ระงับ" (D-005)', () {
      final long = _format(120);
      final short = _format(30);
      expect(long.contains('ล็อก'), isFalse);
      expect(long.contains('ระงับ'), isFalse);
      expect(short.contains('ล็อก'), isFalse);
      expect(short.contains('ระงับ'), isFalse);
    });

    test('clamps negative remaining seconds to 0', () {
      expect(_format(-5), 'รอสักครู่แล้วลองใหม่ · เหลือ 0 วินาที');
    });

    test('rounds up fractional seconds (ceil)', () {
      expect(_format(14.2), 'รอสักครู่แล้วลองใหม่ · เหลือ 15 วินาที');
    });
  });
}
