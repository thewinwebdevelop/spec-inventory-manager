/**
 * ★ The type token and the colour token are not the same question.
 *
 * Stock tailwind-merge reads `text-body-sm` as a colour, because every
 * `text-*` it knows about is one, and then keeps only the last "colour" it
 * sees. `Button`'s `tertiary` variant is defined as small type IN
 * `color.primary`, so it lost its colour the moment it was written and
 * rendered as ordinary body text — the quietest button in the system, quietly
 * broken.
 */
import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn() keeps a type token and a colour token apart", () => {
  it("★ a colour and a size survive each other, in both orders", () => {
    expect(cn("text-primary", "text-button-sm")).toContain("text-primary");
    expect(cn("text-primary", "text-button-sm")).toContain("text-button-sm");
    expect(cn("text-body-sm", "text-text-muted")).toContain("text-body-sm");
    expect(cn("text-body-sm", "text-text-muted")).toContain("text-text-muted");
  });

  it("two SIZES still conflict — the later one wins, which is the point of merging", () => {
    expect(cn("text-body-sm", "text-heading-md")).toBe("text-heading-md");
  });

  it("two COLOURS still conflict", () => {
    expect(cn("text-primary", "text-danger-text")).toBe("text-danger-text");
  });

  it("every type token in tokens.css is registered — a new one must be added here too", () => {
    // The failure this prevents: ux adds `type.body.lg`, somebody uses it with
    // a colour inside a variant, and the colour disappears again.
    const declared = ["heading-md", "heading-sm", "body-md", "body-sm", "label-sm", "button-md", "button-sm"];
    for (const token of declared) {
      expect(cn("text-primary", `text-${token}`), `text-${token} evicted the colour`).toContain(
        "text-primary",
      );
    }
  });
});
