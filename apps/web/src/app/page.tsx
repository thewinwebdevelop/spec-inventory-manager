// T-000-09 — placeholder root route. Real screens/routing/state land with
// the features that need them (see docs/features/F-000/tasks.md T-000-09
// scope note). This page's only job is to prove the dev server returns 200
// and that apps/web consumes the generated TS contracts client for real.
import type { components } from "@omnistock/contracts";

/**
 * Mirrors the convention apps/api uses (health.controller.ts): a local type
 * alias over the generated contract schema, imported directly from
 * `@omnistock/contracts` — never a hand-reshaped/fabricated type. See
 * docs/features/F-000/architecture.md §4.2 (AC11 — TS client must be
 * typecheck-green where imported).
 */
type HealthResponse = components["schemas"]["HealthResponse"];

const placeholderHealth: HealthResponse = {
  status: "ok",
};

export default function HomePage() {
  return (
    <main>
      <h1>OmniStock</h1>
      <p>apps/web placeholder shell (T-000-09).</p>
      <p>
        contracts client wired — sample <code>HealthResponse.status</code>:{" "}
        {placeholderHealth.status}
      </p>
    </main>
  );
}
