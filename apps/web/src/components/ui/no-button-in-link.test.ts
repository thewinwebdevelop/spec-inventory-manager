// Gate for the `ButtonLink` fix (D-038 ②): no `<Button>` may sit directly
// inside a `<Link>` anywhere in src/. That shape is a <button> inside an <a> —
// invalid HTML, two controls to a screen reader, and an inline <a> whose own
// box is 18px tall. Use `ButtonLink` instead.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..", "..");
// `<Link ...>` (props may span lines), optional whitespace, then `<Button`.
const NESTED = /<Link\b[^>]*>\s*<Button\b/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [p] : [];
  });
}

/** Comments describe the old shape (this file, ButtonLink's docs) — not code. */
const stripComments = (text: string): string =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

export function findNested(text: string): number {
  return (stripComments(text).match(NESTED) ?? []).length;
}

describe("no <Button> inside <Link> (use ButtonLink)", () => {
  it("self-check: the pattern catches the shape, across lines, and not its neighbours", () => {
    expect(findNested(`<Link href="/x">\n  <Button>ไป</Button>\n</Link>`)).toBe(1);
    expect(
      findNested(
        `<Link\n  href="/x"\n  onClick={f}\n>\n<Button variant="secondary">ไป</Button></Link>`,
      ),
    ).toBe(1);
    expect(findNested(`<ButtonLink href="/x">ไป</ButtonLink>`)).toBe(0);
    expect(findNested(`<Link href="/x">ข้อความ</Link><Button>อื่น</Button>`)).toBe(0);
    expect(findNested(`// was \`<Link><Button/></Link>\`\n/** <Link><Button/></Link> */`)).toBe(0);
  });

  it("src/ has none", () => {
    const offenders = sources(SRC)
      .map((p) => [relative(SRC, p), findNested(readFileSync(p, "utf8"))] as const)
      .filter(([, n]) => n > 0)
      .map(([p, n]) => `${p} (${n})`);
    expect(offenders).toEqual([]);
  });
});
