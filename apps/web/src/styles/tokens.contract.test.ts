/**
 * ★ The design system and the stylesheet drifted, and nothing noticed.
 *
 * `docs/design-system.md` §1 is the source of truth for tokens, and
 * `tokens.css` says so at the top: "Every value here is copied 1:1 from that
 * document... If a token is missing here, that is a gap to raise with `ux`,
 * not a value to invent."
 *
 * Nothing checked that sentence. D-031 / T-002-X1 extended the document for
 * F-002 — `size.dialog.max-w`, `size.list-row.min-h`, `size.sidebar.w`, the
 * four `size.icon.*`, `type.button.sm`, `color.info.*`, `focus.ring.*` — and
 * ten of those tokens never reached any stylesheet. So the screens were built
 * with hand-typed numbers instead, which is exactly what the file forbids:
 * `max-w-[480px]` in six places, and `ConfirmDialog` wearing `max-w-[400px]`,
 * the AUTH CARD's width, on a dialog the document says is 480 — every confirm
 * dialog rendered 80px narrower than designed, in a codebase whose own doc
 * warns those two tokens are "คนละตัวกับ" each other. Reported by the user as
 * "padding เพี้ยนหมด" (2026-09-01), which is what a token gap looks like from
 * the outside.
 *
 * The mapping below is not invented here — it is the table in design-system.md
 * §1.5 ("Tailwind theme mapping"), which is why a namespace that maps to
 * nothing needs a reason, not an exception.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** cwd is `apps/web` under vitest. */
const REPO_ROOT = join(process.cwd(), "..", "..");
const DOC = join(REPO_ROOT, "docs/design-system.md");
const CSS = join(process.cwd(), "src/styles/tokens.css");

/** First cell of a §1 token table: `| \`namespace.role[.variant]\` | value |`. */
const TOKEN_ROW = /^\|\s*`([a-z]+(?:\.[a-z0-9-]+)+)`\s*\|/gm;

/** design-system.md §1.5, verbatim. */
const PREFIX: Readonly<Record<string, string>> = Object.freeze({
  color: "--color-",
  type: "--text-",
  radius: "--radius-",
  size: "--size-",
  elevation: "--shadow-",
  focus: "--focus-",
  // Added 2026-09-05 with the tokens that closed the last of the hand-typed
  // numbers (`opacity-[.62]`, `z-[100]`). Neither is a Tailwind v4 theme
  // namespace, so both are plain custom properties referenced through
  // arbitrary values — the same treatment `--size-*` already gets, and §1.5
  // now records it.
  opacity: "--opacity-",
  z: "--z-",
});

/**
 * Namespaces that deliberately map to no CSS variable, each with the reason
 * the document gives. A namespace missing from BOTH maps fails the build —
 * silence is not a category.
 */
const NO_VARIABLE: Readonly<Record<string, string>> = Object.freeze({
  icon: "Phosphor icon NAMES (§1.6), not values — the icon set is the token",
  bp: "breakpoints — Tailwind's own `md:`/`lg:`/`xl:` screens",
  space: "the 4-pt grid IS Tailwind's built-in `--spacing` multiplier (§1.5)",
});

/** Individual tokens the document itself marks as having no variable. */
const NO_VARIABLE_TOKEN: ReadonlySet<string> = new Set([
  "type.numeric.tabular", // §1.5: "n/a — kept as the existing .tabular-nums utility"
]);

export function declaredTokens(doc: string): string[] {
  return [...new Set([...doc.matchAll(TOKEN_ROW)].map((m) => m[1]))].sort();
}

/** `color.badge.current.bg` → `--color-badge-current-bg` (§1 naming, 1:1). */
export function cssVariableFor(token: string): string | null {
  const [namespace, ...rest] = token.split(".");
  if (NO_VARIABLE_TOKEN.has(token) || namespace in NO_VARIABLE) return null;
  const prefix = PREFIX[namespace];
  if (!prefix) return `--UNMAPPED-NAMESPACE-${namespace}`;
  return prefix + rest.join("-");
}

export function missingTokens(doc: string, css: string): string[] {
  return declaredTokens(doc)
    .map((t) => [t, cssVariableFor(t)] as const)
    .filter(([, v]) => v !== null && !css.includes(`${v as string}:`))
    .map(([t, v]) => `${t} → ${v as string}`);
}

describe("★ every token design-system.md declares exists in tokens.css", () => {
  const doc = readFileSync(DOC, "utf8");
  const css = readFileSync(CSS, "utf8");

  it("both files were actually read, and the doc really has tokens in it", () => {
    // A scan that found nothing would pass the check below forever.
    expect(declaredTokens(doc).length).toBeGreaterThan(60);
    expect(css).toContain("@theme");
  });

  it("SELF-CHECK: a token missing from the stylesheet is caught, and the n/a ones are not", () => {
    const fakeDoc = [
      "| `color.made-up` | `#fff` | a colour nobody implemented |",
      "| `size.dialog.max-w` | 480px | the dialog width |",
      "| `icon.close` | `X` | Phosphor name, not a value |",
      "| `space.4` | 16px | Tailwind's own multiplier |",
      "| `type.numeric.tabular` | n/a | the .tabular-nums utility |",
    ].join("\n");
    expect(missingTokens(fakeDoc, "--size-dialog-max-w: 480px;")).toEqual([
      "color.made-up → --color-made-up",
    ]);
  });

  it("every namespace is either mapped or has a written reason", () => {
    // The failure this prevents: a new namespace appears in the document, maps
    // to nothing, and is silently skipped rather than noticed.
    const namespaces = new Set(declaredTokens(doc).map((t) => t.split(".")[0]));
    const unclassified = [...namespaces].filter(
      (ns) => !(ns in PREFIX) && !(ns in NO_VARIABLE),
    );
    expect(
      unclassified,
      "add it to PREFIX with its `--var-` prefix, or to NO_VARIABLE with the reason",
    ).toEqual([]);
  });

  it("★ no declared token is missing from the stylesheet", () => {
    expect(
      missingTokens(doc, css),
      "design-system.md declares these and tokens.css does not have them, so screens end up " +
        "with hand-typed numbers. Copy the value across (it is ux's value, not a new one).",
    ).toEqual([]);
  });
});
