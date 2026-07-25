"use client";

import { authTh } from "../../i18n/auth";
import { formatRelativeTimeTh } from "../../lib/relative-time";
import { Button } from "../ui/Button";
import type { components } from "@omnistock/contracts";

type Session = components["schemas"]["Session"];

/** Crude UA-less device labeling — the contract only gives us an opaque
 * `deviceId` string (arch: "not a security boundary", display-only), so we
 * fall back to a generic label per ux-wireframe §4 rather than inventing
 * parsing we can't back with real UA data. */
function deviceLabel(deviceId: string | null): string {
  if (!deviceId) return authTh.sessions.deviceUnknown;
  return deviceId;
}

export function SessionListItem({
  session,
  onLogoutDevice,
}: {
  session: Session;
  onLogoutDevice: (familyId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-default p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{deviceLabel(session.deviceId)}</span>
          {session.current && (
            <span className="rounded-badge bg-badge-current-bg px-2 py-0.5 text-body-sm text-badge-current-text">
              {authTh.sessions.badgeCurrent}
            </span>
          )}
        </div>
        <div className="mt-1 text-body-sm text-text-muted">
          {authTh.sessions.lastActive(
            formatRelativeTimeTh(session.lastUsedAt ?? session.createdAt),
          )}
        </div>
      </div>
      {!session.current && (
        <Button variant="secondary" onClick={() => onLogoutDevice(session.familyId)}>
          {authTh.sessions.action.logoutDevice}
        </Button>
      )}
    </div>
  );
}
