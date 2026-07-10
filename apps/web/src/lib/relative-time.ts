/**
 * Thai-friendly relative time for `SessionListItem.last_active`
 * (ux-wireframe §4: "เมื่อ 2 นาทีที่แล้ว" / "เมื่อวาน 14:32").
 * Pure function of (now, then) so it's unit-testable without real timers.
 */
export function formatRelativeTimeTh(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "เมื่อสักครู่";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `เมื่อ ${diffMin} นาทีที่แล้ว`;
  const diffHour = Math.floor(diffMin / 60);

  const isSameDay =
    now.getFullYear() === then.getFullYear() &&
    now.getMonth() === then.getMonth() &&
    now.getDate() === then.getDate();
  const hh = then.getHours().toString().padStart(2, "0");
  const mm = then.getMinutes().toString().padStart(2, "0");

  if (isSameDay) {
    if (diffHour < 1) return "เมื่อสักครู่";
    return `เมื่อ ${diffHour} ชั่วโมงที่แล้ว`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === then.getFullYear() &&
    yesterday.getMonth() === then.getMonth() &&
    yesterday.getDate() === then.getDate();
  if (isYesterday) return `เมื่อวาน ${hh}:${mm}`;

  const thaiMonths = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const day = then.getDate();
  const month = thaiMonths[then.getMonth()];
  const year = then.getFullYear() + 543; // Buddhist-era display (thai-ux skill)
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}
