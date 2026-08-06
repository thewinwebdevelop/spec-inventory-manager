"use client";

/**
 * T-002-W1 ★ — the active organization (web.md §3.2).
 *
 * The org lives in the URL (`/o/[orgId]/...`), and this provider is the only
 * thing that turns that segment into something a feature can use. Two
 * consequences are load-bearing:
 *
 *  - A feature gets its API client from `useOrgApiClient()`, which reads
 *    `useActiveOrg()`. There is no way to obtain an org-scoped client without
 *    an org in scope, and no way to get one for a DIFFERENT org than the URL.
 *    "Every query is org-scoped" is therefore structural, not a rule someone
 *    has to remember (design-brief B1).
 *  - Switching shops is a navigation. React unmounts this provider and mounts
 *    a new one, every query key changes, and the previous shop's cache is
 *    simply never asked for again (D5). There is no "wipe the cache" step
 *    that could be forgotten.
 *
 * ⛔ `capabilities` here is for deciding what to OFFER — which buttons to
 * show. It is never enforcement: the server refuses the call regardless
 * (architecture §3.1), and every hidden button still needs its error path.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { components } from "@omnistock/contracts";

export type OrgProfile = components["schemas"]["OrgProfile"];

export interface ActiveOrg {
  readonly orgId: string;
  readonly name: string;
  /** What the client may offer — see the ⛔ note above. */
  readonly capabilities: ReadonlySet<string>;
  /** `owner|admin|staff`, or `null` for an F-003 custom role. Display only. */
  readonly roleKey: string | null;
  readonly roleName: string;
  readonly profile: OrgProfile;
}

const ActiveOrgContext = createContext<ActiveOrg | null>(null);

export function toActiveOrg(orgId: string, profile: OrgProfile): ActiveOrg {
  return {
    orgId,
    name: profile.name,
    capabilities: new Set(profile.myMembership.capabilities),
    roleKey: profile.myMembership.roleKey,
    roleName: profile.myMembership.roleName,
    profile,
  };
}

export function ActiveOrgProvider({
  value,
  children,
}: {
  value: ActiveOrg;
  children: ReactNode;
}) {
  // Memoised on the fields that actually change, so a re-render of the layout
  // does not invalidate every consumer.
  const memo = useMemo(() => value, [value]);
  return <ActiveOrgContext.Provider value={memo}>{children}</ActiveOrgContext.Provider>;
}

/**
 * Throws outside `/o/[orgId]`. That is the intended behaviour, not a
 * convenience: a component that needs an org but rendered without one has a
 * routing bug, and failing loudly in development beats rendering an org page
 * with no org (which, absent this, would mean requests with no
 * `X-Organization-Id` and a 422 the user cannot act on).
 */
export function useActiveOrg(): ActiveOrg {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) {
    throw new Error(
      "useActiveOrg was called outside /o/[orgId] — this component must not render on a route without an organization",
    );
  }
  return ctx;
}

/** Present when inside an org, `null` outside. For chrome that renders both. */
export function useActiveOrgOptional(): ActiveOrg | null {
  return useContext(ActiveOrgContext);
}

/**
 * RBAC (design-brief B3). Deliberately a different hook from the
 * entitlement/tier check that F-007 adds — they answer different questions
 * ("may this person?" vs "does this shop's plan include it?") and collapsing
 * them produces an upgrade prompt shown to a Staff member whose shop already
 * has the feature.
 */
export function useCan(capability: string): boolean {
  return useActiveOrg().capabilities.has(capability);
}
