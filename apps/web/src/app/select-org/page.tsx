"use client";

/**
 * ⚠️ PLACEHOLDER — S1 (เลือกร้าน) is T-002-W3's screen, not this.
 *
 * It exists now because `OrgGuard` navigates here on `403 ORG_ACCESS_DENIED`
 * (ux-wireframe §12.1), and a route that 404s would make the removed-member
 * path worse than the failure it is handling. It renders exactly the one
 * thing §12.1 requires and nothing else — no org list, no create-shop CTA.
 *
 * T-002-W3 replaces the body; the `?removed=` contract and the warning
 * (yellow, NOT red — the user did nothing wrong) should survive that.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { errorsTh } from "../../i18n/errors";

/**
 * `useSearchParams` forces client-side rendering for whatever reads it, so
 * Next.js requires a Suspense boundary around it or the whole route bails out
 * of prerendering (and `next build` fails — which is how this was caught:
 * vitest and tsc were both green).
 */
export default function SelectOrgPage() {
  return (
    <Suspense fallback={<SelectOrgBody removed={null} />}>
      <RemovalNotice />
    </Suspense>
  );
}

function RemovalNotice() {
  return <SelectOrgBody removed={useSearchParams().get("removed")} />;
}

function SelectOrgBody({ removed }: { removed: string | null }) {
  return (
    <main className="p-6">
      {removed && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-card border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text"
        >
          {errorsTh.orgAccessDenied.withoutName}
        </div>
      )}
      <h1 className="text-heading-md">เลือกร้านที่จะเข้าใช้งาน</h1>
    </main>
  );
}
