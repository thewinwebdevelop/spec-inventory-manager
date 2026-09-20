/**
 * ★ B-19 — the invitation token, held across sign-in. Memory only.
 *
 * ux-wireframe §11.1 has always said the two doors on `/invite` take the token
 * WITH them ("พา token ไปด้วยใน memory/state") and bring the reader back to
 * the invitation afterwards. The first build kept it in a ref inside the
 * `/invite` tree instead, so walking to `/signup` destroyed it, and the reader
 * who did exactly what the screen told them to came back to
 * "ลิงก์คำเชิญนี้ใช้ไม่ได้ — ลิงก์อาจถูกคัดลอกมาไม่ครบ หรือถูกยกเลิกไปแล้ว",
 * which was true of neither. Found walking M-01 on a phone browser.
 *
 * The note in E-05 said carrying it would mean `sessionStorage` or the URL.
 * It does not: a module-scoped variable is exactly how `token-store.ts` keeps
 * the ACCESS token, which is the stronger credential of the two, and E-12's
 * clauses (not in the URL, history, web storage, cookies or DOM) all still
 * hold. Login and signup are client-side navigations, so the heap survives
 * them; a reload does not, and that is the intended failure — the person opens
 * the link again.
 *
 * The lifetime is kept as short as the journey:
 *  - held only when the reader LEAVES `/invite` for an auth screen;
 *  - taken (read AND cleared) by the next `/invite` that mounts;
 *  - dropped by sign-out, and by a fresh link arriving in the URL;
 *  - forgotten after `HOLD_MS` even if nobody took it, so an abandoned login
 *    on a shared computer does not route the next person to somebody else's
 *    invitation. (The server would refuse their accept anyway — the address
 *    must match — but they should not be shown it.)
 */

/** Long enough to create an account and sign in; short of a lunch break. */
export const HOLD_MS = 30 * 60_000;

/**
 * The only three routes this journey ever visits: the invitation itself and
 * the two doors it can send the reader through to sign in.
 *
 * Severity-Low gap from the B-19 security review: the hold used to survive
 * until `HOLD_MS` no matter where the reader went after leaving `/login` or
 * `/signup` — so wandering off to some unrelated route (its own example:
 * `/login/help`, which is NOT the login screen) left it sitting there,
 * reachable by the next `/invite` mount for up to 30 minutes. `EXACT` match,
 * not a prefix: `/login/help` must NOT count as `/login`.
 */
const INVITE_JOURNEY_ROUTES: ReadonlySet<string> = new Set(["/invite", "/login", "/signup"]);

export function isInviteJourneyRoute(pathname: string): boolean {
  return INVITE_JOURNEY_ROUTES.has(pathname);
}

let held: { token: string; until: number } | null = null;

export function holdInviteToken(token: string, now: number = Date.now()): void {
  if (!token) return;
  held = { token, until: now + HOLD_MS };
}

/** The held token, if one is still live — and the store is empty afterwards. */
export function takeInviteToken(now: number = Date.now()): string | null {
  const live = held !== null && now < held.until ? held.token : null;
  held = null;
  return live;
}

export function hasPendingInvite(now: number = Date.now()): boolean {
  return held !== null && now < held.until;
}

export function dropPendingInvite(): void {
  held = null;
}

/**
 * Where a successful login goes. `/select-org` is ux-wireframe §1.1's answer
 * for everybody else (T-002-Q5); somebody who left an invitation to sign in is
 * going back to it, and presses "เข้าร่วมร้านนี้" themselves — §11.1 forbids
 * accepting on their behalf.
 */
export function destinationAfterLogin(now: number = Date.now()): "/invite" | "/select-org" {
  return hasPendingInvite(now) ? "/invite" : "/select-org";
}
