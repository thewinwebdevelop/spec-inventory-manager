// T-002-M3 — the expiry calculation (domain = plain dart test, no Flutter).
//
// The rule these protect is ux-wireframe §1.4 / Q14: the link's life is read
// from `expiresAt` and NOTHING else. Every hard-coded duration is correct
// until the first elevated-role invitation and wrong afterwards, in the one
// direction that hurts — telling somebody a dead link is still good.
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/org/domain/expiry.dart';

void main() {
  group('formatShopDateTime', () {
    test('★ renders in the SHOP\'s timezone, not the phone\'s', () {
      // 2026-08-09T07:30Z is 14:30 in Bangkok. A phone in London must print
      // the same deadline as the shop's other members see, or two people
      // reading the same invitation disagree about when it dies.
      final utc = DateTime.utc(2026, 8, 9, 7, 30);
      expect(formatShopDateTime(utc), '9 ส.ค. 2026, 14:30');
    });

    test('crossing midnight moves the DAY too', () {
      // 23:00Z on the 9th is 06:00 on the 10th in Bangkok.
      expect(formatShopDateTime(DateTime.utc(2026, 8, 9, 23)), '10 ส.ค. 2026, 06:00');
    });

    test('a local DateTime is normalised, not read as-is', () {
      final utc = DateTime.utc(2026, 1, 1, 0, 5);
      expect(formatShopDateTime(utc.toLocal()), formatShopDateTime(utc));
    });

    test('every month has a Thai abbreviation', () {
      for (var month = 1; month <= 12; month++) {
        final text = formatShopDateTime(DateTime.utc(2026, month, 15, 5));
        expect(text, contains(thaiMonthsShort[month - 1]));
      }
    });
  });

  group('remainingUntil', () {
    final now = DateTime.utc(2026, 8, 9, 7, 30);

    test('7 days out reads in days', () {
      final r = remainingUntil(now.add(const Duration(days: 7)), now: now);
      expect(r.unit, RemainingUnit.days);
      expect(r.value, 7);
    });

    test('24 hours out reads as 1 day, not 24 hours', () {
      final r = remainingUntil(now.add(const Duration(hours: 24)), now: now);
      expect(r.unit, RemainingUnit.days);
      expect(r.value, 1);
    });

    test('under a day reads in hours', () {
      final r = remainingUntil(now.add(const Duration(hours: 6)), now: now);
      expect(r.unit, RemainingUnit.hours);
      expect(r.value, 6);
    });

    test('under an hour reads in minutes', () {
      final r = remainingUntil(now.add(const Duration(minutes: 20)), now: now);
      expect(r.unit, RemainingUnit.minutes);
      expect(r.value, 20);
    });

    test('★ a link with seconds left never reads "0 นาที"', () {
      // Rounding to zero would print a live link as though it had already
      // run out — and the person would stop trying to send it.
      final r = remainingUntil(now.add(const Duration(seconds: 5)), now: now);
      expect(r.unit, RemainingUnit.minutes);
      expect(r.value, 1);
    });

    test('★ exactly now, and any time past, is expired', () {
      expect(remainingUntil(now, now: now).unit, RemainingUnit.expired);
      expect(
        remainingUntil(now.subtract(const Duration(seconds: 1)), now: now).unit,
        RemainingUnit.expired,
      );
    });

    test('a UTC deadline and its local twin give the same answer', () {
      final deadline = now.add(const Duration(hours: 3));
      expect(
        remainingUntil(deadline.toLocal(), now: now).value,
        remainingUntil(deadline, now: now).value,
      );
    });
  });
}
