import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * shadcn/ui's standard `cn()` helper (clsx + tailwind-merge) — presentation
 * only, lives under `components/ui` rather than `src/lib` on purpose: F-001's
 * migration brief (D-020) scopes `src/lib/**` to security/business logic
 * (token-store, auth-client, csrf, validation) that this restyle must not
 * touch. This file has zero business logic — pure class-name composition.
 *
 * ★ EXTENDED, and the reason is a trap worth naming (2026-09-01).
 *
 * This project's type tokens are `--text-heading-md`, `--text-body-sm` and so
 * on, so the utilities are `text-heading-md`, `text-body-sm`. Stock
 * tailwind-merge has never heard of them, guesses "text-<something>" is a
 * COLOUR, and therefore treats `text-body-sm` and `text-text-muted` as two
 * answers to the same question — dropping one:
 *
 *     twMerge("text-primary", "text-button-sm")  ->  "text-button-sm"
 *
 * Static `className` strings are untouched by this (Tailwind emits both
 * classes and they set different CSS properties), so nothing on screen was
 * wrong. It bites only where a colour and a type token meet INSIDE `cn()` or a
 * `cva` variant — which is exactly what happened the moment `Button` grew its
 * `tertiary` variant, whose whole definition is "small type, primary colour":
 * the colour was silently dropped and the quietest button rendered in body
 * text.
 *
 * Registering the token names as font-sizes makes the two kinds of `text-*`
 * different questions again, so neither can evict the other.
 */
const TYPE_TOKENS = [
  "heading-md",
  "heading-sm",
  "body-md",
  "body-sm",
  "label-sm",
  "button-md",
  "button-sm",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_TOKENS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
