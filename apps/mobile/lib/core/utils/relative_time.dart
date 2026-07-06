/// Thai-friendly relative time for `SessionListItem.last_active`
/// (ux-wireframe §4: "เมื่อ 2 นาทีที่แล้ว" / "เมื่อวาน 14:30"). Pure function
/// of (now, then) so it's unit-testable without real timers. Mirrors
/// apps/web/src/lib/relative-time.ts exactly (thai-ux: Buddhist-era display).
String formatRelativeTimeTh(DateTime then, {DateTime? now}) {
  final n = now ?? DateTime.now();
  final diff = n.difference(then);
  final diffSec = diff.inSeconds;

  if (diffSec < 60) return 'เมื่อสักครู่';
  final diffMin = diff.inMinutes;
  if (diffMin < 60) return 'เมื่อ $diffMin นาทีที่แล้ว';
  final diffHour = diff.inHours;

  final isSameDay = n.year == then.year && n.month == then.month && n.day == then.day;
  final hh = then.hour.toString().padLeft(2, '0');
  final mm = then.minute.toString().padLeft(2, '0');

  if (isSameDay) {
    if (diffHour < 1) return 'เมื่อสักครู่';
    return 'เมื่อ $diffHour ชั่วโมงที่แล้ว';
  }

  final yesterday = DateTime(n.year, n.month, n.day - 1);
  final isYesterday =
      yesterday.year == then.year && yesterday.month == then.month && yesterday.day == then.day;
  if (isYesterday) return 'เมื่อวาน $hh:$mm';

  const thaiMonths = [
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
  final day = then.day;
  final month = thaiMonths[then.month - 1];
  final year = then.year + 543; // Buddhist-era display (thai-ux skill)
  return '$day $month $year, $hh:$mm';
}
