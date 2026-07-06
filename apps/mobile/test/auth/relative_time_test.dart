import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/auth/relative_time.dart';

void main() {
  group('formatRelativeTimeTh', () {
    test('less than 60s -> เมื่อสักครู่', () {
      final now = DateTime(2026, 7, 6, 14, 30, 0);
      final then = now.subtract(const Duration(seconds: 30));
      expect(formatRelativeTimeTh(then, now: now), 'เมื่อสักครู่');
    });

    test('minutes ago (same hour)', () {
      final now = DateTime(2026, 7, 6, 14, 30, 0);
      final then = now.subtract(const Duration(minutes: 2));
      expect(formatRelativeTimeTh(then, now: now), 'เมื่อ 2 นาทีที่แล้ว');
    });

    test('hours ago (same day)', () {
      final now = DateTime(2026, 7, 6, 14, 30, 0);
      final then = now.subtract(const Duration(hours: 3));
      expect(formatRelativeTimeTh(then, now: now), 'เมื่อ 3 ชั่วโมงที่แล้ว');
    });

    test('yesterday -> "เมื่อวาน HH:mm"', () {
      final now = DateTime(2026, 7, 6, 14, 30, 0);
      final then = DateTime(2026, 7, 5, 9, 5, 0);
      expect(formatRelativeTimeTh(then, now: now), 'เมื่อวาน 09:05');
    });

    test('older than yesterday -> Thai date with Buddhist-era year', () {
      final now = DateTime(2026, 7, 6, 14, 30, 0);
      final then = DateTime(2026, 6, 23, 14, 30, 0);
      expect(formatRelativeTimeTh(then, now: now), '23 มิ.ย. 2569, 14:30');
    });

    test('defaults `now` to DateTime.now() when omitted', () {
      final justNow = DateTime.now();
      expect(formatRelativeTimeTh(justNow), 'เมื่อสักครู่');
    });
  });
}
