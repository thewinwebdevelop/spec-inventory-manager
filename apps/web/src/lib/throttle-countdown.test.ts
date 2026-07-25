import { describe, expect, it } from "vitest";
import { formatThrottleMessage, pad2 } from "./throttle-countdown";

describe("throttle-countdown (D-005 — no lockout language, ux-wireframe §3.2)", () => {
  it("pad2 zero-pads single digits", () => {
    expect(pad2(5)).toBe("05");
    expect(pad2(0)).toBe("00");
    expect(pad2(42)).toBe("42");
  });

  it("uses the short-form (seconds) copy at exactly 60s", () => {
    const msg = formatThrottleMessage(60);
    expect(msg).toBe("รอสักครู่แล้วลองใหม่ · เหลือ 60 วินาที");
  });

  it("uses the short-form copy under 60s", () => {
    const msg = formatThrottleMessage(45);
    expect(msg).toBe("รอสักครู่แล้วลองใหม่ · เหลือ 45 วินาที");
  });

  it("uses the long-form (mm:ss) copy above 60s", () => {
    const msg = formatThrottleMessage(107); // 1:47
    expect(msg).toBe("ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ 01:47 นาที");
  });

  it("pads minutes and seconds to 2 digits in long form", () => {
    const msg = formatThrottleMessage(3661); // 61:01
    expect(msg).toBe("ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ · เหลือ 61:01 นาที");
  });

  it("clamps negative input to 0 (never shows negative countdown)", () => {
    const msg = formatThrottleMessage(-5);
    expect(msg).toBe("รอสักครู่แล้วลองใหม่ · เหลือ 0 วินาที");
  });

  it("rounds fractional seconds up (ceil) so the display never undercounts", () => {
    const msg = formatThrottleMessage(44.2);
    expect(msg).toBe("รอสักครู่แล้วลองใหม่ · เหลือ 45 วินาที");
  });

  it("NEVER contains forbidden lockout language (D-005 hard rule)", () => {
    const forbidden = ["ล็อก", "ระงับ", "แบน"];
    for (const seconds of [5, 45, 60, 61, 107, 3600]) {
      const msg = formatThrottleMessage(seconds);
      for (const word of forbidden) {
        expect(msg).not.toContain(word);
      }
    }
  });
});
