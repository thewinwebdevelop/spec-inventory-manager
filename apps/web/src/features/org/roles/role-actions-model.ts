/**
 * T-003-W08 / W09 — what the clone and delete controls do on R3/R4.
 *
 * Pure, and decided ONLY from the server: `viewer.*` (the verdicts, in the
 * server's fixed reason order — api-spec §3) and `isSystem` (the Owner role).
 * ⛔ Never from the viewer's local capabilities (repo lesson "client-invented
 * server facts"); the server still refuses whatever this shows.
 *
 * ux-wireframe §0.3 "ลำดับบนจอ R4":
 *  - `canEdit.reason` is the ONE main banner;
 *  - `canDelete.reason` is shown under the delete button ONLY when it differs
 *    from `canEdit.reason` — equal ⇒ the button is hidden (no repeating);
 *  - `canClone`: allowed → button · `role_limit_reached` → disabled + reason ·
 *    any other reason → hidden (the main banner covers it).
 * ux R4 table: `writes_disabled` → clone and delete DISABLED (the single top
 * banner explains, nothing is repeated) · the Owner shows neither (AC-3.2).
 */
import type { components } from "@omnistock/contracts";
import {
  createOrCloneBlockedReasonCopy,
  deleteBlockedReasonCopy,
  type ReasonCopy,
} from "../role-copy";
import { roleDeleteTh } from "./i18n";

type Verdict = components["schemas"]["RoleWriteVerdict"];
export interface RoleViewer {
  readonly canEdit: Verdict;
  readonly canDelete: Verdict;
  readonly canClone: Verdict;
}

const WRITES_DISABLED = "writes_disabled";

export type CloneAffordance =
  | { kind: "hidden" }
  /** `banner` = inside the R4 reason banner · `section` = "การจัดการอื่น". */
  | { kind: "link"; place: "banner" }
  | { kind: "disabled"; place: "banner" | "section"; note?: string };

/** R4 only — R3 keeps its own clone control in "การจัดการอื่น" (W06). */
export function cloneAffordance(viewer: RoleViewer, isSystem: boolean): CloneAffordance {
  if (isSystem) return { kind: "hidden" };
  const { canClone } = viewer;
  if (canClone.allowed) return { kind: "link", place: "banner" };
  if (canClone.reason === WRITES_DISABLED) return { kind: "disabled", place: "section" };
  if (canClone.reason === "role_limit_reached") {
    // R4 is opened directly — there is no `limit` in hand (§0.3 fallback sentence).
    const copy = createOrCloneBlockedReasonCopy(canClone.reason, null);
    return { kind: "disabled", place: "banner", note: copy?.body };
  }
  return { kind: "hidden" };
}

export type DeleteAffordance =
  | { kind: "hidden" }
  | { kind: "enabled" }
  /** Disabled with no note of its own (`writes_disabled` — the top banner explains). */
  | { kind: "disabled" }
  /** Disabled + the R5 (ข) panel under it (numbers from `usage`). */
  | { kind: "in-use" }
  | { kind: "blocked"; copy: ReasonCopy };

/** R3 and R4. On R3 `canEdit` is allowed, so its reason is `null` and never equals. */
export function deleteAffordance(viewer: RoleViewer, isSystem: boolean): DeleteAffordance {
  if (isSystem) return { kind: "hidden" };
  const { canDelete, canEdit } = viewer;
  if (canDelete.allowed) return { kind: "enabled" };
  if (canDelete.reason === WRITES_DISABLED) return { kind: "disabled" };
  const editReason = canEdit.allowed ? null : canEdit.reason;
  if (editReason !== null && canDelete.reason === editReason) return { kind: "hidden" };
  if (canDelete.reason === "in_use") return { kind: "in-use" };
  return { kind: "blocked", copy: deleteBlockedReasonCopy(canDelete.reason, "") };
}

/**
 * R5 (ข) count line — §0.2 with the parts that are 0 dropped:
 * "สมาชิก {n} คน[ (รวมคุณ)] · คำเชิญที่ยังไม่ปิด {m} ใบ". Empty when both are 0.
 */
export function inUseCountLine(
  usage: { readonly activeMembers: number; readonly pendingInvitations: number },
  isViewerRole: boolean,
): string {
  const parts: string[] = [];
  if (usage.activeMembers > 0)
    parts.push(roleDeleteTh.inUse.members(usage.activeMembers, isViewerRole));
  if (usage.pendingInvitations > 0)
    parts.push(roleDeleteTh.inUse.invitations(usage.pendingInvitations));
  return parts.join(" · ");
}
