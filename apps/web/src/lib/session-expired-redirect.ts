/**
 * Shared "session is dead" redirect (client-security review Important #4 —
 * ux-wireframe §7: "เด้งออกไปหน้า /login ทันที + toast สุภาพ ... ใช้ข้อความ
 * เดียวกันทุกสาเหตุ"). Every screen that calls an authenticated auth-client
 * function must funnel a caught `SessionExpiredError` through this single
 * function so the redirect + query-param toast trigger are identical
 * everywhere (mirrors the `?signupSuccess=1` pattern the login page already
 * uses for the signup-success toast) — no screen should hand-roll its own
 * "give up and reload" behavior (e.g. SessionList's previous retry button,
 * which would have looped forever against an already-dead session).
 */
export function redirectToLoginSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.location.href = "/login?sessionExpired=1";
}
