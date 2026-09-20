/**
 * T-002-W6 ★ — the invitation token arrives in the URL, and must not stay
 * there (ux-wireframe §11, api-spec §3.14, security review I-6).
 *
 * ── Why the URL is the wrong place for it ─────────────────────────────────
 * The token is a bearer credential for membership of a shop. A URL is the
 * leakiest place a credential can sit, and every one of these is a real path
 * out, not a theoretical one:
 *
 *   - `Referer` on any outbound link or embedded resource;
 *   - browser history, which is synced across devices by default;
 *   - the address bar itself — screenshares, shoulders, "send me that page";
 *   - server access logs, if the page is ever server-rendered;
 *   - analytics and error reporters, which capture `location.href` by habit.
 *
 * The invitation ENDPOINTS already refuse to take it from a query string (I-6:
 * both preview and accept read it from the body). This is the other half of
 * that decision — the link has to carry it, so the page takes it out of the
 * URL at the first opportunity and keeps it in memory alone.
 *
 * `history.replaceState` rather than `pushState`: pushing would leave the
 * token-bearing entry in history and put it one Back press away, which is the
 * opposite of the point.
 */

/** The query parameter the invite link uses (`/invite?token=…`). */
export const INVITE_TOKEN_PARAM = "token";

export interface StrippedUrl {
  /** The token, or `null` when the link carried none. */
  readonly token: string | null;
  /** The same URL with the token removed — what history should hold instead. */
  readonly cleanUrl: string;
}

/**
 * Splits a token out of a URL. Pure, so the rule is testable without a DOM.
 *
 * Everything else in the URL is preserved: a link may legitimately carry other
 * parameters, and dropping them would break flows this file knows nothing
 * about. Only the token is removed, and only if present.
 */
export function stripInviteToken(href: string): StrippedUrl {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Not a URL we can parse — return it untouched rather than guessing, and
    // report no token, which fails closed (the screen shows "invalid link").
    return { token: null, cleanUrl: href };
  }

  const token = url.searchParams.get(INVITE_TOKEN_PARAM);
  if (token === null) return { token: null, cleanUrl: href };

  url.searchParams.delete(INVITE_TOKEN_PARAM);
  // `?` with nothing after it is noise in the address bar and in logs.
  const search = url.searchParams.toString();
  const cleanUrl = `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
  return { token: token === "" ? null : token, cleanUrl };
}
