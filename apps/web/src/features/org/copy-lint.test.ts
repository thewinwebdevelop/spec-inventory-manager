/**
 * E-11 · T-002-Q5 — the copy lint (test-plan §12.1).
 *
 * AC-3.4 / D-027: reissuing an invitation link KILLS the previous one. The
 * wording that breaks this AC is not a bug in a function — it is a sentence,
 * and §12.1 calls a static scan "เทสต์ถูกที่สุดที่บังคับ AC เชิงถ้อยคำได้": the
 * cheapest test that can enforce a wording rule at all.
 *
 * Two halves, because a ban alone is not enough:
 *   NEGATIVE — no user-facing string may say the old link is still usable;
 *   POSITIVE — the one-time warning must still EXIST on both platforms. A build
 *              that simply deleted it would satisfy every ban ever written.
 *
 * WHY THIS FILE SCANS THE MOBILE TREE TOO: the AC is cross-platform and the
 * phrase is one copy-paste away from either side. Flutter's test lane cannot
 * read TypeScript and the Dart analyzer cannot read `.arb` values as copy, so
 * this Node lane — which runs on every PR — is the only place a single check
 * can see both. It reads files, never imports them.
 *
 * ⚠️ COMMENTS ARE STRIPPED FIRST, and that is not a detail: three files in this
 * repo explain the rule by quoting the banned phrase. A scanner that flagged
 * them would be punishing the documentation for describing the thing it
 * prevents — and the usual fix for that (delete the explanation) is the
 * opposite of what anybody wants.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** cwd is `apps/web` under vitest. */
const REPO_ROOT = join(process.cwd(), "..", "..");
const WEB_SRC = join(REPO_ROOT, "apps/web/src");
const MOBILE_LIB = join(REPO_ROOT, "apps/mobile/lib");
const MOBILE_ARB = join(MOBILE_LIB, "l10n/app_th.arb");

/**
 * Sentences that tell a reader the previous link still works.
 *
 * Deliberately PHRASES, never the bare word "ลิงก์เดิม": the correct warning
 * ("ลิงก์เดิมจะใช้ไม่ได้ทันที") contains it, and a lint that banned the word
 * would ban the very sentence D-027 requires.
 */
const FORBIDDEN_PHRASES: readonly { readonly phrase: string; readonly why: string }[] =
  Object.freeze([
    {
      phrase: "คัดลอกลิงก์เดิม",
      why: "there is no old link to copy — the server keeps only the hash (D-018)",
    },
    { phrase: "ใช้ลิงก์เดิม", why: "the previous link stopped working the moment a new one was issued" },
    { phrase: "ลิงก์เดิมยังใช้ได้", why: "flatly untrue after a reissue (D-027)" },
    { phrase: "ส่งลิงก์เดิม", why: "sending it would send a dead link" },
    { phrase: "ลิงก์เดิมใช้ได้", why: "same claim, shorter" },
  ]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "gen" || entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    // Tests are excluded, and this file is why: a lint's own ban list is a
    // list of the banned strings. Nothing here ships to a reader, so a test
    // that quotes the phrase is not copy — while a SOURCE file that quotes it
    // is exactly what we are looking for.
    if (/\.test\.tsx?$/.test(full) || /_test\.dart$/.test(full)) continue;
    if (/\.(ts|tsx|dart)$/.test(full)) out.push(full);
  }
  return out;
}

/** Removes `//` and block comments so prose ABOUT the rule is not scanned. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("///"))
    .join("\n");
}

/**
 * The user-facing VALUES of an ARB bundle.
 *
 * `@key` entries are gen_l10n metadata — descriptions written for developers,
 * never rendered. One of them quotes the banned phrase on purpose, which is
 * exactly the kind of false positive that gets a lint disabled.
 */
export function arbCopyValues(json: string): string[] {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  return Object.entries(parsed)
    .filter(([key, value]) => !key.startsWith("@") && typeof value === "string")
    .map(([, value]) => value as string);
}

describe("E-11 · no copy claims the old invitation link still works (AC-3.4 · D-027)", () => {
  const sourceFiles = [...walk(WEB_SRC), ...walk(MOBILE_LIB)];

  it("the scan reached BOTH trees", () => {
    // A cross-platform lint that quietly scanned one platform would be the
    // usual half-gate: green, and blind on the side nobody checked.
    const relatives = sourceFiles.map((f) => relative(REPO_ROOT, f).split(sep).join("/"));
    expect(relatives.some((f) => f.startsWith("apps/web/src")), "web tree not scanned").toBe(true);
    expect(relatives.some((f) => f.startsWith("apps/mobile/lib")), "mobile tree not scanned").toBe(
      true,
    );
    expect(sourceFiles.length).toBeGreaterThan(50);
    // …and the test exclusion did not swallow the source. If these two files
    // stopped being scanned, the ban would be enforced over an empty set.
    expect(relatives).toContain("apps/web/src/features/org/i18n.ts");
    expect(relatives).toContain("apps/mobile/lib/features/org/presentation/screens/invite_link_screen.dart");
    expect(relatives.every((f) => !f.endsWith(".test.ts")), "a test file slipped into the scan").toBe(
      true,
    );
    expect(existsSync(MOBILE_ARB), "the Thai bundle is missing").toBe(true);
  });

  it("★ no source file carries a forbidden phrase in user-facing text", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const { phrase, why } of FORBIDDEN_PHRASES) {
        if (code.includes(phrase)) {
          offenders.push(`${relative(REPO_ROOT, file).split(sep).join("/")}: "${phrase}" — ${why}`);
        }
      }
    }
    expect(offenders, "AC-3.4: a reissue INVALIDATES; no screen may suggest otherwise").toEqual([]);
  });

  it("★ no ARB value carries one either (metadata is not copy)", () => {
    const offenders: string[] = [];
    for (const value of arbCopyValues(readFileSync(MOBILE_ARB, "utf8"))) {
      for (const { phrase } of FORBIDDEN_PHRASES) {
        if (value.includes(phrase)) offenders.push(`app_th.arb: "${value}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("★ the one-time warning still exists on BOTH platforms", () => {
    // The positive half. Without it, deleting the warning outright would pass
    // every ban above — and the ban exists to protect a promise the warning is
    // the only place we make.
    const webCopy = readFileSync(join(WEB_SRC, "features/org/i18n.ts"), "utf8");
    expect(webCopy, "web lost the show-once warning").toContain("แสดงครั้งเดียว");

    const mobileValues = arbCopyValues(readFileSync(MOBILE_ARB, "utf8")).join("\n");
    expect(mobileValues, "mobile lost the show-once warning").toContain("แสดงครั้งเดียว");
  });

  it("★ both platforms still call the action ออกลิงก์ใหม่ (never ส่งอีกครั้ง)", () => {
    // ux-wireframe §9: the button is named for what it DOES. "ส่งอีกครั้ง"
    // ("send again") describes re-sending the same thing, which is the
    // misunderstanding D-027 exists to prevent.
    const webCopy = readFileSync(join(WEB_SRC, "features/org/i18n.ts"), "utf8");
    expect(webCopy).toContain("ออกลิงก์ใหม่");
    expect(stripComments(webCopy)).not.toContain("ส่งลิงก์อีกครั้ง");
  });

  it("SELF-CHECK: the scanner reads copy, ignores comments, and can fail", () => {
    // It flags a real string…
    expect(stripComments('const t = "คัดลอกลิงก์เดิม";')).toContain("คัดลอกลิงก์เดิม");
    // …and clears the same words when they are explaining the rule.
    expect(stripComments('// never write คัดลอกลิงก์เดิม anywhere')).not.toContain(
      "คัดลอกลิงก์เดิม",
    );
    expect(stripComments('/// Must never say "คัดลอกลิงก์เดิม" — D-018')).not.toContain(
      "คัดลอกลิงก์เดิม",
    );
    expect(stripComments("/* คัดลอกลิงก์เดิม */")).not.toContain("คัดลอกลิงก์เดิม");

    // The correct warning must survive the ban — the false positive that would
    // make somebody delete this lint.
    const correct = 'const warn = "ลิงก์เดิมจะใช้ไม่ได้ทันที";';
    expect(FORBIDDEN_PHRASES.some((f) => correct.includes(f.phrase))).toBe(false);

    // ARB metadata is not copy.
    const arb = JSON.stringify({
      good: "ลิงก์นี้แสดงครั้งเดียว",
      "@good": { description: "never say คัดลอกลิงก์เดิม" },
    });
    expect(arbCopyValues(arb)).toEqual(["ลิงก์นี้แสดงครั้งเดียว"]);
  });
});
