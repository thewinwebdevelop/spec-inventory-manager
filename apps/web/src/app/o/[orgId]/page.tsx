"use client";

/**
 * ⚠️ PLACEHOLDER — the shop home screen belongs to T-002-W3 (S3 AppShell) and
 * ultimately to F-030's dashboard.
 *
 * It exists so `/o/[orgId]` is a real, reachable route: without a page, the
 * layout and its guard are code nothing can render, and "the org shell works"
 * would be an untested claim. It renders only what proves the context is
 * wired — the shop's own name and the caller's role, both from
 * `useActiveOrg()`.
 */
import { useActiveOrg } from "../../../lib/org/org-context";

export default function OrgHomePage() {
  const org = useActiveOrg();
  return (
    <main className="p-6">
      <h1 className="text-heading-md">{org.name}</h1>
      <p className="text-body-sm">{org.roleName}</p>
    </main>
  );
}
