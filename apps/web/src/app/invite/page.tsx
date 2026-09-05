/**
 * S11 — `/invite` (ux-wireframe §11). Routing only.
 *
 * NOT under `/o/[orgId]`: the reader is not in the shop yet, and may not have
 * an account at all. `InvitationPreview` is deliberately public and carries no
 * `organizationId`, no full address and no member list.
 */
import { InviteScreen } from "../../features/invite/components/InviteScreen";

export default function InvitePage() {
  return <InviteScreen />;
}
