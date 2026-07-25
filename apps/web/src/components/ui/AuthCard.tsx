import type { ReactNode } from "react";

/**
 * Centered ~400px card w/ light shadow — web auth layout (ux-wireframe §2,
 * design-system.md `size.auth-card.max-w` / `elevation.card`). Mobile (F-006)
 * renders the same form full-screen without this wrapper.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[var(--size-auth-card-max-w)] rounded-card bg-surface p-card-padding shadow-card">
        {children}
      </div>
    </div>
  );
}
