/// T-002-M3 — rendering an invitation's expiry (ux-wireframe §1.4, §9.1).
///
/// Pure Dart (gate rule 1): no `intl`, no `BuildContext`, no locale loading.
/// Two things are computed here and NEITHER of them is copy — the words live
/// in `app_th.arb`, and this file only decides which number goes in them.
///
/// ⛔ Never print "7 วัน" or "24 ชั่วโมง" as a literal. The TTL depends on the
/// invited ROLE (24h for an elevated one, 7 days otherwise — D-028/I-7) and is
/// recomputed server-side on every reissue (D-027), so a hard-coded duration
/// is correct until the first Owner invitation and wrong forever after, in the
/// direction that matters: telling somebody a dead link is still good.
library;

/// Phase 0 is Asia/Bangkok only (D-013), and Thailand has no DST — so a fixed
/// +07:00 is exact, not an approximation.
///
/// Deliberately not `DateTime.toLocal()`: the shop's day is what the copy
/// promises ("ลิงก์ใช้ได้ถึง …"), and a phone in another timezone would
/// otherwise print a different deadline than the one the shop's other members
/// see. Deliberately not `intl`'s `DateFormat` either — that needs locale data
/// initialised before first use, which a pure function cannot guarantee, and
/// it has no timezone support at all.
const Duration bangkokOffset = Duration(hours: 7);

/// Thai month abbreviations — data, not copy: they are fixed by the calendar,
/// not chosen by `ux`, and there is no locale in which this list differs.
const List<String> thaiMonthsShort = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

/// "9 ส.ค. 2026, 14:30" — the instant, in the shop's timezone.
///
/// The year is the Gregorian one, as written in every example in
/// ux-wireframe §7/§9.1. (Note for `ux`: the web client formats the same
/// instant with `Intl.DateTimeFormat("th-TH")`, whose default calendar for
/// that locale is Buddhist — so web says "2569" where this says "2026". One
/// of the two is wrong and it is a copy decision, not a client decision.)
String formatShopDateTime(DateTime instant) {
  final t = instant.toUtc().add(bangkokOffset);
  final hh = t.hour.toString().padLeft(2, '0');
  final mm = t.minute.toString().padLeft(2, '0');
  return '${t.day} ${thaiMonthsShort[t.month - 1]} ${t.year}, $hh:$mm';
}

/// Which unit the "(อีกประมาณ …)" phrase is counted in.
enum RemainingUnit { expired, minutes, hours, days }

/// How much of the link's life is left, rounded — precision here is false
/// comfort, and the exact instant is printed right next to it anyway.
class Remaining {
  const Remaining(this.unit, this.value);

  final RemainingUnit unit;

  /// 0 when [unit] is [RemainingUnit.expired].
  final int value;
}

Remaining remainingUntil(DateTime expiresAt, {DateTime? now}) {
  final ms = expiresAt.difference(now ?? DateTime.now()).inMilliseconds;
  // `<= 0` and not `< 0`: a link that expires exactly now is expired. The
  // client's clock is not authoritative here — the server decides `expired`
  // (it computes the status at read time) — but a countdown that has run out
  // must never read "อีกประมาณ 0 นาที".
  if (ms <= 0) return const Remaining(RemainingUnit.expired, 0);

  const hourMs = 3600 * 1000;
  const dayMs = 24 * hourMs;
  if (ms >= dayMs) return Remaining(RemainingUnit.days, (ms / dayMs).round());
  if (ms >= hourMs) return Remaining(RemainingUnit.hours, (ms / hourMs).round());
  // Floor of 1: "อีกประมาณ 1 นาที" is honest about "very soon"; 0 is not.
  return Remaining(RemainingUnit.minutes, (ms / 60000).round().clamp(1, 59));
}
