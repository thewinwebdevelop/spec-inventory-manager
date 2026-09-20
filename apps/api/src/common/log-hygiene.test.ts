// F-002 · T-002-Q1/U-API-14 — what the logs must never contain.
//
// ⚠️ READ THIS BEFORE TRUSTING THE ID. test-plan U-API-14 asks for a test of
// "logger config: redact `token`/`tokenHash`/`taxId`/`password*`; never log the
// query string of `/invitations/*`; never log the body of preview/accept".
//
// There is no logger config to test. `apps/api` has no structured logger: it
// uses Nest's built-in one, capped in `main.ts` at `["log","warn","error"]`,
// and there is no redaction layer anywhere. Writing a test against a `redact`
// list would have meant writing the list first — which is `devops` D2 plus a
// `backend-api` decision, not a QA one.
//
// So this file proves the thing that IS provable today, and it is the half that
// matters: nothing in the source hands a secret, a token-bearing URL or a
// request body to a logger. That is the property the redaction list would
// exist to guarantee. When the structured logger lands (D2), its `redact`
// config becomes the second layer and this gate stays as the first — because a
// redaction list only covers the field names somebody remembered to list,
// while this covers every logger call in the tree.
//
// Reported as a gap rather than closed silently: see tasks.md T-002-Q1.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * Identifiers whose VALUE must never reach a log line.
 *
 * The word appearing in a message ("token refresh failed") is fine and
 * common — what is forbidden is interpolating or passing the value. The
 * scanner below strips string literals before matching, so only expressions
 * are considered.
 */
const FORBIDDEN_IN_LOG_ARGUMENTS: readonly RegExp[] = Object.freeze([
  /\btokenHash\b/,
  /\brawToken\b/,
  /\btoken\b/,
  /\btaxId\b/,
  /\bpassword\w*\b/,
  /\bpasswordHash\b/,
  // A request's URL carries the invitation token in the one place the client
  // was told never to put it (I-6) — and `originalUrl`/`req.url` is exactly how
  // it gets into a log line by accident.
  /\boriginalUrl\b/,
  /\breq(uest)?\.url\b/,
  /\breq(uest)?\.query\b/,
  /\breq(uest)?\.body\b/,
]);

/** Every way this codebase writes a log line. */
const LOG_CALL =
  /(?:this\.logger|logger|console)\s*\.\s*(?:log|warn|error|debug|verbose|info|trace)\s*\(/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Strip comments, so a file EXPLAINING the rule is not reported as breaking it. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/**
 * The argument text of every log call in [source], with string literals
 * blanked out.
 *
 * Blanking the literals is the whole trick: `logger.warn("invalid token")` is
 * prose about a token and must pass, while `logger.warn(\`token=${token}\`)`
 * and `logger.warn({ token })` must not. Interpolations inside a template are
 * kept — they are expressions.
 */
export function logCallArguments(source: string): string[] {
  const text = code(source);
  const found: string[] = [];

  for (const match of text.matchAll(LOG_CALL)) {
    const start = match.index + match[0].length;
    // Walk to the matching close paren, tracking nesting so an object or a
    // nested call does not end the argument list early.
    let depth = 1;
    let i = start;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    found.push(blankLiterals(text.slice(start, i - 1)));
  }
  return found;
}

/** Replace the CONTENT of string literals with spaces, keeping `${…}` bodies. */
function blankLiterals(argumentText: string): string {
  let out = "";
  let i = 0;
  while (i < argumentText.length) {
    const ch = argumentText[i];
    if (ch === '"' || ch === "'") {
      i++;
      while (i < argumentText.length && argumentText[i] !== ch) {
        if (argumentText[i] === "\\") i++;
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    if (ch === "`") {
      i++;
      while (i < argumentText.length && argumentText[i] !== "`") {
        if (argumentText[i] === "\\") {
          i += 2;
          continue;
        }
        // An interpolation is an EXPRESSION — keep it.
        if (argumentText[i] === "$" && argumentText[i + 1] === "{") {
          let depth = 1;
          i += 2;
          out += "${";
          while (i < argumentText.length && depth > 0) {
            if (argumentText[i] === "{") depth++;
            else if (argumentText[i] === "}") depth--;
            out += argumentText[i];
            i++;
          }
          continue;
        }
        i++;
      }
      i++;
      out += "``";
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

describe("log hygiene (U-API-14 — the half that is provable without a logger config)", () => {
  const files = walk(SRC)
    .map((f) => relative(SRC, f).split(sep).join("/"))
    .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".int.test.ts"))
    .filter((f) => !f.startsWith("__boundary_fixtures__/"));

  it("the scan walked the real source tree", () => {
    expect(existsSync(SRC), `expected the api source tree at ${SRC}`).toBe(true);
    expect(files.length).toBeGreaterThan(20);
    // Files that DO log, so the scanner is looking at something.
    expect(files).toContain("prisma/prisma.service.ts");
    expect(files).toContain("auth/security-events.service.ts");
  });

  it("the scan actually found log calls (a matcher that finds nothing proves nothing)", () => {
    const total = files.reduce(
      (n, file) => n + logCallArguments(readFileSync(join(SRC, file), "utf8")).length,
      0,
    );
    expect(total, "no log call was found anywhere in src/ — the matcher is broken").toBeGreaterThan(
      5,
    );
  });

  it("★ no log call passes a token, a tax id, a password or a request URL/body", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const argumentText of logCallArguments(readFileSync(join(SRC, file), "utf8"))) {
        for (const pattern of FORBIDDEN_IN_LOG_ARGUMENTS) {
          if (pattern.test(argumentText)) {
            offenders.push(`${file}: ${pattern} in \`${argumentText.trim().slice(0, 120)}\``);
          }
        }
      }
    }
    expect(
      offenders,
      "a log line carrying one of these is a secret at rest in whatever ships the logs — and for " +
        "an invitation URL it is a working credential (I-6/D-018: the token is the credential). " +
        "Log an id, a masked value, or a count.",
    ).toEqual([]);
  });

  it("★ no Prisma client is built with query logging — parameters include hashes and tax ids", () => {
    // `log: ["query"]` prints every statement WITH ITS PARAMETERS, which on
    // this schema means `passwordHash`, `tokenHash` and `taxIdEncrypted` in
    // plaintext in the log. It is one word in a constructor and no redaction
    // list would catch it, because the value never passes through a field name
    // the logger knows about.
    for (const file of files) {
      const source = code(readFileSync(join(SRC, file), "utf8"));
      if (!/new\s+PrismaClient|extends\s+PrismaClient/.test(source)) continue;
      expect(
        /log\s*:\s*\[[^\]]*["'`]query["'`]/.test(source),
        `${file}: query logging would print statement PARAMETERS — hashes and tax ids`,
      ).toBe(false);
    }
  });

  it("★ the bootstrap logger stays at log/warn/error — debug and verbose are not shipped", () => {
    const main = readFileSync(join(SRC, "main.ts"), "utf8");
    const levels = /logger\s*:\s*\[([^\]]*)\]/.exec(code(main));
    expect(levels, "main.ts no longer caps the Nest logger levels").not.toBeNull();
    const listed = levels![1];
    for (const level of ["debug", "verbose"]) {
      expect(
        listed.includes(level),
        `main.ts enables "${level}" — Nest's ${level} channel prints framework internals ` +
          `including resolved route parameters`,
      ).toBe(false);
    }
  });

  it("SELF-CHECK: the scanner flags the real mistakes and clears the prose", () => {
    // ── must be flagged ──────────────────────────────────────────────────
    const bad = [
      "this.logger.warn(`accept failed for token=${token}`);",
      "this.logger.log({ tokenHash });",
      "console.error('x', req.url);",
      "logger.debug(`taxId=${profile.taxId}`);",
      "this.logger.error(`body ${JSON.stringify(request.body)}`);",
      "logger.log(`reset for ${user.passwordHash}`);",
    ];
    for (const snippet of bad) {
      const args = logCallArguments(snippet);
      expect(args.length, snippet).toBe(1);
      expect(
        FORBIDDEN_IN_LOG_ARGUMENTS.some((p) => p.test(args[0])),
        `NOT FLAGGED: ${snippet}`,
      ).toBe(true);
    }

    // ── must pass ────────────────────────────────────────────────────────
    const fine = [
      // The WORD, in prose. Every one of these exists in the codebase.
      'this.logger.warn("invalid token — refusing the request");',
      "this.logger.log(`password policy rejected the candidate`);",
      'console.warn("taxId is never logged");',
      // Ids and counts are the correct thing to log.
      "this.logger.log(`invitation ${invitationId} reissued`);",
      "this.logger.warn(`${count} rows scoped`);",
    ];
    for (const snippet of fine) {
      const args = logCallArguments(snippet);
      expect(args.length, snippet).toBe(1);
      expect(
        FORBIDDEN_IN_LOG_ARGUMENTS.filter((p) => p.test(args[0])),
        `FALSE POSITIVE: ${snippet}`,
      ).toEqual([]);
    }

    // A file documenting the rule is not a file breaking it.
    expect(logCallArguments("// never logger.warn(`${token}`)")).toEqual([]);
    expect(logCallArguments("/* this.logger.log({ taxId }) would leak */")).toEqual([]);

    // Nesting: an object or a nested call must not end the argument early.
    const nested = logCallArguments("this.logger.log({ a: fn(1, 2), b: token });");
    expect(nested).toHaveLength(1);
    expect(FORBIDDEN_IN_LOG_ARGUMENTS.some((p) => p.test(nested[0]))).toBe(true);
  });
});
