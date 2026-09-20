/**
 * S2 — สร้างร้านใหม่ (`/orgs/new`). Routing only.
 *
 * Not under `/o/[orgId]`: there is no shop yet, and the call behind it is
 * user-scoped. Putting it inside the org shell would require an org the user
 * is in the middle of not having.
 */
import { CreateOrgScreen } from "../../../features/org/components/CreateOrgScreen";

export default function CreateOrgPage() {
  return <CreateOrgScreen />;
}
