/**
 * S1 — เลือกร้าน (`/select-org`). Routing only; the screen is
 * `features/org/components/SelectOrgScreen`.
 *
 * The Suspense boundary is required, not stylistic: `SelectOrgScreen` reads
 * `useSearchParams()` (the `?removed=` notice from §12.1), which opts the
 * route out of prerendering unless it is wrapped — `next build` fails
 * otherwise, with vitest and tsc both green.
 */
import { Suspense } from "react";
import { SelectOrgScreen } from "../../features/org/components/SelectOrgScreen";

export default function SelectOrgPage() {
  return (
    <Suspense>
      <SelectOrgScreen />
    </Suspense>
  );
}
