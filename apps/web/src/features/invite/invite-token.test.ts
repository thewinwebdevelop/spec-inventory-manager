// T-002-W6 ★ — the token must leave the URL, and every failure must leave a
// way out (ux-wireframe §11, security review I-6).
import { describe, it, expect } from "vitest";
import { stripInviteToken, INVITE_TOKEN_PARAM } from "./invite-token";
import { toInviteError, HANDLED_INVITE_CODES } from "./invite-error";
import { ApiRequestError } from "../../lib/api/error";

const TOKEN = "9f2b7c1d4e5a6b7c8d9e0f1a2b3c4d5e";

describe("stripInviteToken", () => {
  it("★ returns the token AND a URL that no longer contains it", () => {
    // The URL is the leakiest place a bearer credential can sit: Referer,
    // synced history, the address bar during a screenshare, access logs,
    // analytics that capture `location.href` by habit. The endpoints already
    // refuse to read it from a query string (I-6); this is the other half.
    const { token, cleanUrl } = stripInviteToken(
      `https://app.omnistock.co/invite?${INVITE_TOKEN_PARAM}=${TOKEN}`,
    );
    expect(token).toBe(TOKEN);
    expect(cleanUrl).toBe("/invite");
    expect(cleanUrl).not.toContain(TOKEN);
  });

  it("★ keeps every OTHER parameter — it removes the token, not the query", () => {
    // A link may legitimately carry more (a campaign tag, a return path).
    // Dropping the lot would break flows this module knows nothing about.
    const { token, cleanUrl } = stripInviteToken(
      `https://app.omnistock.co/invite?from=line&${INVITE_TOKEN_PARAM}=${TOKEN}&lang=th`,
    );
    expect(token).toBe(TOKEN);
    expect(cleanUrl).toBe("/invite?from=line&lang=th");
    expect(cleanUrl).not.toContain(TOKEN);
  });

  it("leaves no dangling `?` when the token was the only parameter", () => {
    // Cosmetic in the bar, but it also ends up in logs and screenshots.
    expect(stripInviteToken(`https://x.co/invite?${INVITE_TOKEN_PARAM}=${TOKEN}`).cleanUrl).toBe(
      "/invite",
    );
  });

  it("preserves the fragment", () => {
    const { cleanUrl } = stripInviteToken(
      `https://x.co/invite?${INVITE_TOKEN_PARAM}=${TOKEN}#section`,
    );
    expect(cleanUrl).toBe("/invite#section");
  });

  it("reports no token for a link that carries none, and changes nothing", () => {
    const href = "https://app.omnistock.co/invite";
    expect(stripInviteToken(href)).toEqual({ token: null, cleanUrl: href });
  });

  it("★ an EMPTY token is `null`, not an empty string", () => {
    // `?token=` would otherwise send `""` to the API and produce a confusing
    // 404 instead of the honest "this link is not complete".
    expect(stripInviteToken(`https://x.co/invite?${INVITE_TOKEN_PARAM}=`).token).toBeNull();
  });

  it("fails CLOSED on an unparseable input", () => {
    // No token reported ⇒ the screen shows "invalid link" rather than
    // guessing at a substring.
    expect(stripInviteToken("not a url").token).toBeNull();
  });
});

describe("toInviteError — §11.4's table", () => {
  const err = (status: number, code: string) =>
    new ApiRequestError(status, { error: { code, message: "x" } });

  it("★ every failure offers a way out — none is a dead end", () => {
    // The reader did nothing wrong: they clicked a link somebody sent them.
    // A screen with no next step means asking the shop owner over chat
    // without knowing what to ask for.
    for (const code of HANDLED_INVITE_CODES) {
      const mapped = toInviteError(err(409, code));
      expect(mapped.next, code).toBeDefined();
      expect(mapped.title.length, code).toBeGreaterThan(0);
      expect(mapped.body.length, code).toBeGreaterThan(0);
    }
  });

  it("★ the six 409s do NOT share a next step — the code is what decides", () => {
    // Status alone cannot tell these apart, and they lead different places:
    // "already a member" walks you into the shop, "superseded" sends you back
    // to the owner for a new link.
    expect(toInviteError(err(409, "ALREADY_MEMBER")).next).toEqual({ kind: "enter-org" });
    expect(toInviteError(err(409, "INVITATION_ALREADY_ACCEPTED")).next).toEqual({ kind: "login" });
    expect(toInviteError(err(409, "INVITATION_SUPERSEDED")).next).toEqual({ kind: "home" });
  });

  it("★ an email mismatch offers to switch account, never to retry", () => {
    // §11.3. Retrying with the same session produces the same 403 forever.
    expect(toInviteError(err(403, "INVITATION_EMAIL_MISMATCH")).next).toEqual({
      kind: "switch-account",
    });
  });

  it("★ ALREADY_MEMBER says the existing role is untouched (I-9)", () => {
    // Accepting twice must not read as "something changed" — the server
    // deliberately leaves the membership alone.
    expect(toInviteError(err(409, "ALREADY_MEMBER")).body).toContain("ไม่ถูกเปลี่ยน");
  });

  it("429 carries a countdown, and never a zero-length one", () => {
    expect(toInviteError(new ApiRequestError(429, null, 90)).retryAfterSeconds).toBe(90);
    expect(toInviteError(new ApiRequestError(429, null)).retryAfterSeconds).toBe(60);
  });

  it("an unknown code and a network failure both fall back to retry", () => {
    expect(toInviteError(err(409, "SOMETHING_NEW")).next).toEqual({ kind: "retry" });
    expect(toInviteError(new TypeError("Failed to fetch")).next).toEqual({ kind: "retry" });
  });

  it("never shows the user a raw code or a status number", () => {
    for (const code of [...HANDLED_INVITE_CODES, "SOMETHING_NEW"]) {
      const mapped = toInviteError(err(409, code));
      expect(`${mapped.title} ${mapped.body}`).not.toMatch(/[A-Z_]{4,}/);
    }
  });
});
