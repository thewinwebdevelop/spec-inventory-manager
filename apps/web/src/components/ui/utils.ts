import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui's standard `cn()` helper (clsx + tailwind-merge) — presentation
 * only, lives under `components/ui` rather than `src/lib` on purpose: F-001's
 * migration brief (D-020) scopes `src/lib/**` to security/business logic
 * (token-store, auth-client, csrf, validation) that this restyle must not
 * touch. This file has zero business logic — pure class-name composition.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
