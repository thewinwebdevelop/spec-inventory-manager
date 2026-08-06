/**
 * `/o/{orgId}` — the shop's home page.
 *
 * ux-wireframe §5: Phase 0 has no dashboard (that is F-030), so S4
 * "ข้อมูลร้าน" stands in as the landing screen. Same component as
 * `/o/{orgId}/settings/org`, deliberately — two routes, one screen, rather
 * than a redirect that would make the back button behave oddly.
 */
import { OrgProfileScreen } from "../../../features/org/components/OrgProfileScreen";

export default function OrgHomePage() {
  return <OrgProfileScreen />;
}
