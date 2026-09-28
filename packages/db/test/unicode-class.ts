// F-003 · T-003-B10 — helpers for G3-07 (Unicode parity, SR-04 · data-model §2.1).
//
// The DB rejects role names holding a forbidden code point with a regex bracket
// expression written in a migration (CHECK "Role_name_shape"). core-domain
// rejects the same names in `validateRoleName`. The two must be the SAME set,
// or a name core-domain lets through (after a Node/ICU upgrade adds a new Cf)
// is one the DB never checked — or vice versa. These helpers turn both sides
// into a Set<number> so the test can compare them exactly.
//
// THE SET (PM 2026-09-28, from the B04 security review — widened from the
// data-model's Cc ∪ Cf): invisible characters outside Cc/Cf also let a name
// look like the reserved "เจ้าของร้าน". Forbidden =
//   Cc ∪ Cf ∪ Default_Ignorable_Code_Point ∪ Co ∪ Cs
//   ∪ {U+115F, U+1160, U+3164, U+FFA0 (Hangul fillers), U+2800 (braille blank)}
// T-003-B04 exports the core-domain constant for this set; until that lands on
// this base the definition below is the single machine source the migration's
// class is generated from (renderEscapedClass) and checked against.
//
// Convention the parser enforces (fail loud, never "skip what I can't read"):
// a forbidden-character class in migration SQL is a quoted bracket expression
// `'[...]'` written ONLY with `\uXXXX` / `\UXXXXXXXX` escapes and `-` ranges. A
// bracket literal holding a raw non-ASCII character is refused: it cannot be
// reviewed in a diff (invisible characters are the very thing it guards against).

/** The forbidden set as a Unicode-property regex — the definition, not a list. */
export const ROLE_NAME_FORBIDDEN_SET_REGEX =
  /^[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Co}\p{Cs}\u115F\u1160\u3164\uFFA0\u2800]$/u;

/** Every code point 0..0x10FFFF a single-code-point `re` matches (lone surrogates included). */
export function codePointSet(re: RegExp): Set<number> {
  const out = new Set<number>();
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    if (re.test(String.fromCodePoint(cp))) out.add(cp);
  }
  return out;
}

/** The forbidden role-name set under THIS Node's Unicode tables. */
export function forbiddenRoleNameSet(): Set<number> {
  return codePointSet(ROLE_NAME_FORBIDDEN_SET_REGEX);
}

const ESCAPE = /\\u([0-9A-Fa-f]{4})|\\U([0-9A-Fa-f]{8})/y;

function readEscape(body: string, at: number): { cp: number; next: number } {
  ESCAPE.lastIndex = at;
  const m = ESCAPE.exec(body);
  if (!m) {
    throw new Error(
      `unicode class: expected \\uXXXX or \\UXXXXXXXX at offset ${at} of '[${body}]' — ` +
        `a forbidden-character class must be written with escapes only`,
    );
  }
  return { cp: parseInt(m[1] ?? m[2], 16), next: ESCAPE.lastIndex };
}

/** Parses the inside of a bracket expression (`\u0001-\u001F\u00AD…`) into code points. */
export function parseEscapedBracketClass(body: string): Set<number> {
  const out = new Set<number>();
  let i = 0;
  if (body.length === 0) throw new Error("unicode class: empty bracket expression");
  while (i < body.length) {
    const lo = readEscape(body, i);
    i = lo.next;
    let hi = lo.cp;
    if (body[i] === "-") {
      const h = readEscape(body, i + 1);
      hi = h.cp;
      i = h.next;
      if (hi < lo.cp) throw new Error(`unicode class: reversed range in '[${body}]'`);
    }
    for (let cp = lo.cp; cp <= hi; cp++) out.add(cp);
  }
  return out;
}

/**
 * Every forbidden-character class in `sql`: a quoted bracket expression `'[...]'` that holds
 * at least one `\u`/`\U` escape. A bracket literal holding a raw non-ASCII
 * character THROWS (see the convention above).
 */
export function extractForbiddenClasses(sql: string): string[] {
  const out: string[] = [];
  const bracketLiteral = /'\[([^\]']*)\]'/g;
  for (const m of sql.matchAll(bracketLiteral)) {
    const body = m[1];
    // eslint-disable-next-line no-control-regex
    if (/[^\x00-\x7F]/.test(body)) {
      throw new Error(
        `unicode class: raw non-ASCII character in '[${body}]' — write it as \\uXXXX/\\UXXXXXXXX`,
      );
    }
    if (/\\[uU]/.test(body)) out.push(body);
  }
  return out;
}

/** Hex list of code points in `a` but not in `b` (for readable failure messages). */
export function difference(a: Set<number>, b: Set<number>): string[] {
  return [...a]
    .filter((cp) => !b.has(cp))
    .sort((x, y) => x - y)
    .map((cp) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`);
}

/** A set rendered as the SQL escape string (what the migration's class must be). */
export function renderEscapedClass(set: Set<number>): string {
  const cps = [...set].sort((a, b) => a - b);
  const esc = (cp: number) =>
    cp <= 0xffff
      ? `\\u${cp.toString(16).toUpperCase().padStart(4, "0")}`
      : `\\U${cp.toString(16).toUpperCase().padStart(8, "0")}`;
  let s = "";
  for (let i = 0; i < cps.length;) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    s += i === j ? esc(cps[i]) : `${esc(cps[i])}-${esc(cps[j])}`;
    i = j + 1;
  }
  return s;
}
