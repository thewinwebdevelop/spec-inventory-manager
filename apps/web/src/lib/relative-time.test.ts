import { describe, expect, it } from "vitest";
import { formatRelativeTimeTh } from "./relative-time";

describe("formatRelativeTimeTh (ux-wireframe §4)", () => {
  const now = new Date("2026-07-06T14:32:00.000Z");

  it("renders 'เมื่อสักครู่' for < 60s ago", () => {
    const then = new Date(now.getTime() - 30_000).toISOString();
    expect(formatRelativeTimeTh(then, now)).toBe("เมื่อสักครู่");
  });

  it("renders 'เมื่อ N นาทีที่แล้ว' for a couple minutes ago", () => {
    const then = new Date(now.getTime() - 2 * 60_000).toISOString();
    expect(formatRelativeTimeTh(then, now)).toBe("เมื่อ 2 นาทีที่แล้ว");
  });

  it("renders 'เมื่อ N ชั่วโมงที่แล้ว' for same-day, hours ago", () => {
    const then = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTimeTh(then, now)).toBe("เมื่อ 3 ชั่วโมงที่แล้ว");
  });

  it("renders 'เมื่อวาน HH:MM' for yesterday", () => {
    const then = new Date("2026-07-05T14:32:00.000Z");
    expect(formatRelativeTimeTh(then.toISOString(), now)).toMatch(/^เมื่อวาน \d{2}:\d{2}$/);
  });

  it("renders an absolute Thai date for older timestamps", () => {
    const then = new Date("2026-06-20T10:00:00.000Z");
    const result = formatRelativeTimeTh(then.toISOString(), now);
    expect(result).toMatch(/\d{1,2} .+ \d{4}, \d{2}:\d{2}/);
  });
});
