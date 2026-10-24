// F-003 · T-003-QA07 ★ — the authority lemma (architecture §1.3 "เหตุผลเชิงรูปแบบ"
// · §13.6 lemma · test-plan §2.4 · D-034 + Addendum + Addendum 2 · D-035 P2 ·
// SR-16/SR-17). U-RB-18 property single-step · U-RB-19 controls c1–c4 ·
// U-RB-20 BFS (2 actors, depth 4).
//
// The claim (§1.3): MM = active non-Owner members holding `manage_members`;
//   U(s) = { T active non-Owner : ∄ Y ∈ MM, Y ≠ T, caps(T) ⊊ caps(Y) }
// = the members no non-Owner can reset. For ANY number of non-Owner actors and
// ANY number of steps, if T ∈ U and T is not the one acting, T stays in U — so
// "lower → reset → raise" impersonation never opens. Out of scope (on purpose):
// the Owner's own ops (D-030), ops T performs on itself, rolling F-002 instances.
//
// Every allow/refuse decision below comes from the REAL core-domain fns
// (`decideMemberAuthority` · `decideRoleWrite` · `decideAdminReset` ·
// `canAcceptInvitation` + `decideInviterRecheck`). The test owns only:
//   • the state model (who holds which role, what an allowed op changes) and
//   • `U` — the lemma's DEFINITION, computed on expanded sets with bit masks
//     here, independently of the fns, so a weakened rule cannot move both sides.
// Decisions are memoised per (rules variant × input) — the fns are pure, so a
// cached answer IS the fn's answer; it is what keeps the enumeration fast.
//
// Fixture registry {manage_members, manage_roles, X, Y} (+ Owner `full_access`):
// X/Y are two real registry keys with no `implies` edge (asserted below), so the
// fns run on the shipped registry and `decideAdminReset` (which has no registry
// parameter) sees exactly the same keys as everything else.
import { describe, it, expect } from "vitest";
import { CAPABILITY_FULL_ACCESS, CAPABILITY_MANAGE_MEMBERS } from "../auth/capabilities";
import { CAPABILITY_MANAGE_ROLES, CAPABILITY_REGISTRY } from "./registry";
import { expandCapabilities } from "./expand";
import { validateRoleCapabilities, type ValidatedCapabilities } from "./role-validation";
import {
  decideMemberAuthority,
  type MemberAuthorityInput,
  type MemberAuthorityResult,
} from "./member-authority";
import { decideRoleWrite, type RoleWriteInput, type RoleWriteResult } from "./role-write";
import { decideAdminReset } from "../orgs/admin-reset-authz";
import { canAcceptInvitation, decideInviterRecheck } from "../orgs/invitation-policy";

// ── fixture registry as bit masks ───────────────────────────────────────────
const X = "manage_orders";
const Y = "manage_stock";
const KEYS = [CAPABILITY_MANAGE_MEMBERS, CAPABILITY_MANAGE_ROLES, X, Y] as const;
const LETTERS = ["mm", "mr", "X", "Y"] as const;
const MM = 1; // bit of manage_members
const MR = 2; // bit of manage_roles
const XB = 4; // bit of X
const YB = 8; // bit of Y
const OWNER = 16; // mask of the Owner role: ["full_access"]
const MASKS = Array.from({ length: 15 }, (_, i) => i + 1); // every non-empty subset
const DELETED = -1;
/** Exhaustive runs take seconds, not ms — explicit per-test budget. */
const SLOW = 300_000;

const CAPS: readonly (readonly string[])[] = Array.from({ length: 17 }, (_, m) =>
  m === OWNER ? [CAPABILITY_FULL_ACCESS] : KEYS.filter((_, i) => m & (1 << i)),
);
const maskOf = (caps: readonly string[]) =>
  KEYS.reduce((acc, k, i) => (caps.includes(k) ? acc | (1 << i) : acc), 0);
/** Expanded mask through the REAL expansion (fixture keys only; Owner never compared here). */
const EXP: readonly number[] = CAPS.map((c) => maskOf(expandCapabilities(c)));
/** `next` for create/update — only the real constructor makes one. */
const VALIDATED: readonly (ValidatedCapabilities | null)[] = CAPS.map((c) => {
  const v = validateRoleCapabilities(c);
  return v.ok ? v.capabilities : null;
});
const show = (m: number) =>
  m === OWNER ? "{full_access}" : `{${LETTERS.filter((_, i) => m & (1 << i)).join(",")}}`;

/** Lemma side, NOT the rule: a ⊊ b on expanded sets (non-Owner masks only). */
const strictlyBelow = (a: number, b: number) => (EXP[a] & EXP[b]) === EXP[a] && EXP[a] !== EXP[b];
const holdsMM = (m: number) => m !== OWNER && (EXP[m] & MM) !== 0;

// ── state model ─────────────────────────────────────────────────────────────
interface Member {
  readonly id: string;
  readonly owner: boolean;
  readonly active: boolean;
  /** Index into `roles`; -1 for a revoked member (its old role is irrelevant). */
  readonly role: number;
}
interface Invitation {
  /** Index into `roles` (the role may since have been deleted → `role_unavailable`). */
  readonly role: number;
  readonly issuer: string;
}
interface State {
  readonly members: readonly Member[];
  /** `roles[0]` is the Owner role (isSystem). A deleted role is `DELETED`. */
  readonly roles: readonly number[];
  readonly inv: Invitation | null;
}
const OWNER_MEMBER: Member = { id: "O", owner: true, active: true, role: 0 };

const member = (s: State, id: string) => s.members.find((m) => m.id === id)!;
const maskIn = (s: State, m: Member) => s.roles[m.role];
const isActor = (m: Member) => m.active && !m.owner;

/** Who can reset T in `s` per the lemma's definition (§1.3) — independent of the fns. */
function witnesses(s: State, t: Member): string[] {
  const tm = maskIn(s, t);
  return s.members
    .filter((y) => isActor(y) && y.id !== t.id && holdsMM(maskIn(s, y)))
    .filter((y) => strictlyBelow(tm, maskIn(s, y)))
    .map((y) => y.id);
}
function U(s: State): string[] {
  return s.members.filter((t) => isActor(t) && witnesses(s, t).length === 0).map((t) => t.id);
}

// ── ops ─────────────────────────────────────────────────────────────────────
type Op =
  | { kind: "patch"; actor: string; target: string; grantRole: number | null; grantMask: number }
  | { kind: "remove" | "reset"; actor: string; target: string }
  | { kind: "role_update"; actor: string; role: number; next: number | "unchanged" }
  | { kind: "role_delete" | "role_clone"; actor: string; role: number }
  | { kind: "role_create"; actor: string; mask: number }
  | { kind: "invite_create"; actor: string; grantRole: number | null; grantMask: number }
  | { kind: "invite_reissue" | "invite_cancel"; actor: string }
  | { kind: "accept"; actor: string };

/** Grant options: every existing role (role identity matters for later edits) + an unheld role of every mask. */
function grants(s: State): { grantRole: number | null; grantMask: number }[] {
  const out: { grantRole: number | null; grantMask: number }[] = [];
  s.roles.forEach((m, r) => {
    if (m !== DELETED) out.push({ grantRole: r, grantMask: m });
  });
  for (const m of MASKS) out.push({ grantRole: null, grantMask: m });
  return out;
}

/**
 * What a generated op may touch: `"all"`, only the unheld role `rf`, or only the
 * pending invitation (see `cases` for why this factoring is exact).
 */
type Scope = "all" | "invitation" | { readonly rf: number };

/** Every op of every listed actor (§13.6: PATCH/DELETE others + self, every grant, role writes incl. own role, invites, accept, reset). */
function* opsOf(s: State, actorIds: readonly string[], scope: Scope = "all"): Generator<Op> {
  const all = scope === "all";
  const rf = typeof scope === "object" ? scope.rf : null;
  const targets = s.members.filter((m) => m.active);
  const roleIdx = rf !== null ? [rf] : s.roles.flatMap((m, r) => (m === DELETED ? [] : [r]));
  const gs = rf !== null ? [{ grantRole: rf, grantMask: s.roles[rf] }] : grants(s);
  for (const id of actorIds) {
    const a = member(s, id);
    if (!a || !isActor(a)) continue;
    if (scope !== "invitation") {
      for (const t of targets) {
        for (const g of gs) yield { kind: "patch", actor: id, target: t.id, ...g };
        if (all) yield { kind: "remove", actor: id, target: t.id };
        if (all) yield { kind: "reset", actor: id, target: t.id };
      }
      for (const r of roleIdx) {
        for (const next of MASKS) yield { kind: "role_update", actor: id, role: r, next };
        yield { kind: "role_update", actor: id, role: r, next: "unchanged" };
        yield { kind: "role_delete", actor: id, role: r };
        yield { kind: "role_clone", actor: id, role: r };
      }
      if (all) for (const mask of MASKS) yield { kind: "role_create", actor: id, mask };
      if (s.inv === null) for (const g of gs) yield { kind: "invite_create", actor: id, ...g };
    }
    if (s.inv !== null && (all || scope === "invitation")) {
      yield { kind: "invite_reissue", actor: id };
      yield { kind: "invite_cancel", actor: id };
    }
  }
  if (s.inv !== null && (all || scope === "invitation")) {
    yield { kind: "accept", actor: `N${s.members.length}` };
  }
}

// ── rules: the real fns, or a control that disables ONE leg ─────────────────
interface Rules {
  readonly memberAuthority: (i: MemberAuthorityInput) => MemberAuthorityResult;
  readonly roleWrite: (i: RoleWriteInput) => RoleWriteResult;
}
const REAL: Rules = {
  memberAuthority: (i) => decideMemberAuthority(i),
  roleWrite: (i) => decideRoleWrite(i),
};
const OK = { ok: true } as const;
/**
 * Each control turns ONE refusal reason of a real fn into "this leg passes"
 * (test-local wrapper, no production seam). When the reason is the fn's LAST
 * check, that is plain `ok` (c1, c4). When later checks follow it (c2: the grant
 * axis comes after the target axis; c3: before ⊊ comes after the floor), the
 * wrapper re-asks the REAL fn with only that leg out of the way — otherwise the
 * control would also switch off the next leg and go red for the wrong reason
 * (observed: a plain-ok c2 went red through PATCHes that exceed the actor).
 */
const CONTROLS = {
  /** c1 — drop before ⊊ of `decideRoleWrite` on update/delete (D-034 Addendum). Last check → ok. */
  c1: {
    ...REAL,
    roleWrite: (i) => {
      const r = decideRoleWrite(i);
      return !r.ok && r.reason === "target_not_below_actor" ? OK : r;
    },
  },
  /**
   * c2 — drop the target axis of `change_role` (D-034 · SR-16). The grant axis
   * still applies: re-asked with `actorIsTarget: true`, which in the real fn
   * skips exactly the target axis of `change_role` and nothing else.
   */
  c2: {
    ...REAL,
    memberAuthority: (i) => {
      const r = decideMemberAuthority(i);
      return i.op === "change_role" && !r.ok && r.reason === "target_not_below_actor"
        ? decideMemberAuthority({ ...i, actorIsTarget: true })
        : r;
    },
  },
  /**
   * c3 — drop the `manage_members` floor of `write_held_role` (Addendum 2 ·
   * SR-17). before ⊊ actor still applies: asked of the real fn with
   * `manage_members` added to BOTH sides (before ⊆ actor already passed and
   * neither holds it, so before∪mm ⊊ actor∪mm ⇔ before ⊊ actor).
   */
  c3: {
    ...REAL,
    roleWrite: (i) => {
      const r = decideRoleWrite(i);
      if (r.ok || r.reason !== "requires_manage_members" || i.op === "create") return r;
      const v = decideMemberAuthority({
        op: "write_held_role",
        actorCapabilities: [...i.actorCapabilities, CAPABILITY_MANAGE_MEMBERS],
        actorIsTarget: false,
        targetCurrentCapabilities: [...i.role.capabilities, CAPABILITY_MANAGE_MEMBERS],
      });
      return v.ok || v.reason !== "target_not_below_actor"
        ? OK
        : { ok: false, reason: "target_not_below_actor", relation: v.relation, excess: v.excess };
    },
  },
  /** c4 — let PATCH-yourself skip the grant axis (last check → ok). */
  c4: {
    ...REAL,
    memberAuthority: (i) => {
      const r = decideMemberAuthority(i);
      return i.op === "change_role" && i.actorIsTarget && !r.ok && r.reason === "exceeds_actor"
        ? OK
        : r;
    },
  },
} satisfies Record<string, Rules>;
type ControlName = keyof typeof CONTROLS;

const T0 = Date.UTC(2026, 9, 1, 12);
const ISSUED = new Date(T0);
const NOW = new Date(T0 + 60 * 60 * 1000); // one hour after issue — never expired

/** Packs small ints (each < 32) into one Map key. */
const pack = (...xs: number[]) => xs.reduce((acc, x) => acc * 32 + x, 0);
const INVITE_OPS = ["invite_create", "invite_reissue", "invite_cancel"] as const;

/** Memoised decisions for one rules variant (the fns are pure — the cache returns their answer). */
class Decider {
  private readonly cache = new Map<number, boolean>();
  constructor(private readonly rules: Rules) {}
  private memo(key: number, f: () => boolean): boolean {
    let v = this.cache.get(key);
    if (v === undefined) {
      v = f();
      this.cache.set(key, v);
    }
    return v;
  }
  changeRole(actor: number, target: number, grant: number, self: boolean) {
    return this.memo(
      pack(1, actor, target, grant, +self),
      () =>
        this.rules.memberAuthority({
          op: "change_role",
          actorCapabilities: CAPS[actor],
          actorIsTarget: self,
          targetCurrentCapabilities: CAPS[target],
          grantCapabilities: CAPS[grant],
        }).ok,
    );
  }
  remove(actor: number, target: number, self: boolean) {
    return this.memo(
      pack(2, actor, target, +self),
      () =>
        this.rules.memberAuthority({
          op: "remove",
          actorCapabilities: CAPS[actor],
          actorIsTarget: self,
          targetCurrentCapabilities: CAPS[target],
        }).ok,
    );
  }
  invite(op: "invite_create" | "invite_reissue" | "invite_cancel", actor: number, grant: number) {
    return this.memo(
      pack(3, INVITE_OPS.indexOf(op), actor, grant),
      () =>
        this.rules.memberAuthority({
          op,
          actorCapabilities: CAPS[actor],
          actorIsTarget: false,
          grantCapabilities: CAPS[grant],
        }).ok,
    );
  }
  roleUpdate(
    actor: number,
    roleIdx: number,
    before: number,
    next: number | "unchanged",
    holders: number,
  ) {
    return this.memo(
      pack(4, actor, +(roleIdx === 0), before, next === "unchanged" ? 17 : next, holders),
      () => {
        const n = next === "unchanged" ? "unchanged" : VALIDATED[next];
        if (n === null) throw new Error(`fixture: mask ${next} does not validate`);
        return this.rules.roleWrite({
          op: "update",
          actorCapabilities: CAPS[actor],
          role: { isSystem: roleIdx === 0, capabilities: CAPS[before] },
          next: n,
          otherActiveHolders: holders,
        }).ok;
      },
    );
  }
  roleDelete(actor: number, roleIdx: number, before: number, holders: number) {
    return this.memo(
      pack(5, actor, +(roleIdx === 0), before, holders),
      () =>
        this.rules.roleWrite({
          op: "delete",
          actorCapabilities: CAPS[actor],
          role: { isSystem: roleIdx === 0, capabilities: CAPS[before] },
          otherActiveHolders: holders,
        }).ok,
    );
  }
  create(actor: number, mask: number) {
    const next = VALIDATED[mask];
    if (next === null) return false; // clone of the Owner role: FULL_ACCESS_RESERVED before any rule
    return this.memo(
      pack(6, actor, mask),
      () =>
        this.rules.roleWrite({
          op: "create",
          actorCapabilities: CAPS[actor],
          next,
          otherActiveHolders: 0,
        }).ok,
    );
  }
  // Allowed-option tables (each entry asked of the fn above) — let the BFS walk
  // only allowed ops instead of generating every refused one.
  private readonly lists = new Map<number, readonly number[]>();
  private list(key: number, f: () => number[]): readonly number[] {
    let v = this.lists.get(key);
    if (v === undefined) {
      v = f();
      this.lists.set(key, v);
    }
    return v;
  }
  patchGrants(actor: number, target: number, self: boolean) {
    return this.list(pack(11, actor, target, +self), () =>
      [...MASKS, OWNER].filter((g) => this.changeRole(actor, target, g, self)),
    );
  }
  inviteGrants(actor: number) {
    return this.list(pack(12, actor), () =>
      [...MASKS, OWNER].filter((g) => this.invite("invite_create", actor, g)),
    );
  }
  /** Allowed `next` masks; 17 = "unchanged". */
  updateNexts(actor: number, roleIdx: number, before: number, holders: number) {
    return this.list(pack(13, actor, +(roleIdx === 0), before, holders), () =>
      [...MASKS, 17].filter((n) =>
        this.roleUpdate(actor, roleIdx, before, n === 17 ? "unchanged" : n, holders),
      ),
    );
  }
  createMasks(actor: number) {
    return this.list(pack(14, actor), () => MASKS.filter((m) => this.create(actor, m)));
  }
  /** Always the REAL admin-reset gate (controls never touch it). */
  reset(caller: number, target: number, self: boolean) {
    return this.memo(
      pack(7, caller, target, +self),
      () =>
        decideAdminReset({
          caller: { status: "active", capabilities: CAPS[caller] },
          target: { status: "active", capabilities: CAPS[target] },
          targetActiveMembershipsInOtherOrgs: 0,
          targetUserExists: true,
          callerIsTarget: self,
        }).allowed,
    );
  }
  /** Always REAL: `canAcceptInvitation` (new user) then the D-035 re-check of the issuer. */
  accept(role: number | null, issuer: number | null) {
    return this.memo(pack(8, role ?? 31, issuer ?? 31), () => {
      const roleCaps = role === null ? null : CAPS[role];
      const verdict = canAcceptInvitation({
        invitation: {
          status: "pending",
          expiresAt: new Date(T0 + 24 * 60 * 60 * 1000),
          tokenIssuedAt: ISSUED,
        },
        membership: null,
        role: roleCaps === null ? null : { capabilities: roleCaps },
        now: NOW,
      });
      if (verdict !== "ok" || roleCaps === null) return false;
      return (
        decideInviterRecheck({
          inviter: issuer === null ? null : { capabilities: CAPS[issuer] },
          invitationRoleCapabilities: roleCaps,
        }) === "ok"
      );
    });
  }
}

const otherActiveHolders = (s: State, role: number, actor: string) =>
  s.members.filter((m) => m.active && m.role === role && m.id !== actor).length;

function allowed(s: State, op: Op, d: Decider): boolean {
  if (op.kind === "accept") {
    const inv = s.inv!;
    const roleMask = s.roles[inv.role];
    const issuer = member(s, inv.issuer);
    return d.accept(
      roleMask === DELETED ? null : roleMask,
      issuer.active ? maskIn(s, issuer) : null,
    );
  }
  const a = member(s, op.actor);
  const am = maskIn(s, a);
  switch (op.kind) {
    case "patch": {
      const t = member(s, op.target);
      return d.changeRole(am, maskIn(s, t), op.grantMask, t.id === a.id);
    }
    case "remove": {
      const t = member(s, op.target);
      return d.remove(am, maskIn(s, t), t.id === a.id);
    }
    case "reset": {
      const t = member(s, op.target);
      return d.reset(am, maskIn(s, t), t.id === a.id);
    }
    case "role_update":
      return d.roleUpdate(
        am,
        op.role,
        s.roles[op.role],
        op.next,
        otherActiveHolders(s, op.role, a.id),
      );
    case "role_delete":
      // + ROLE_IN_USE (service rule, §1.3 DELETE): any active holder blocks the delete.
      return (
        d.roleDelete(am, op.role, s.roles[op.role], otherActiveHolders(s, op.role, a.id)) &&
        otherActiveHolders(s, op.role, "") === 0
      );
    case "role_clone":
      return d.create(am, s.roles[op.role]);
    case "role_create":
      return d.create(am, op.mask);
    case "invite_create":
      return d.invite("invite_create", am, op.grantMask);
    case "invite_reissue":
    case "invite_cancel": {
      const g = s.roles[s.inv!.role];
      return g !== DELETED && d.invite(op.kind, am, g);
    }
  }
}

/**
 * Exactly `[...opsOf(s, actorIds)].filter((op) => allowed(s, op, d))`, built
 * from the allowed-option tables so refused ops are never materialised (BFS
 * speed). Equality with the plain form is pinned by a test below.
 */
function* allowedOps(s: State, actorIds: readonly string[], d: Decider): Generator<Op> {
  const targets = s.members.filter((m) => m.active);
  const roleIdx = s.roles.flatMap((m, r) => (m === DELETED ? [] : [r]));
  const byMask = (masks: readonly number[]) => {
    const out: { grantRole: number | null; grantMask: number }[] = [];
    for (const r of roleIdx)
      if (masks.includes(s.roles[r])) out.push({ grantRole: r, grantMask: s.roles[r] });
    for (const m of masks) if (m !== OWNER) out.push({ grantRole: null, grantMask: m });
    return out;
  };
  for (const id of actorIds) {
    const a = member(s, id);
    if (!a || !isActor(a)) continue;
    const am = maskIn(s, a);
    for (const t of targets) {
      const self = t.id === id;
      for (const g of byMask(d.patchGrants(am, maskIn(s, t), self)))
        yield { kind: "patch", actor: id, target: t.id, ...g };
      if (d.remove(am, maskIn(s, t), self)) yield { kind: "remove", actor: id, target: t.id };
      if (d.reset(am, maskIn(s, t), self)) yield { kind: "reset", actor: id, target: t.id };
    }
    for (const r of roleIdx) {
      for (const n of d.updateNexts(am, r, s.roles[r], otherActiveHolders(s, r, id)))
        yield { kind: "role_update", actor: id, role: r, next: n === 17 ? "unchanged" : n };
      const del: Op = { kind: "role_delete", actor: id, role: r };
      if (allowed(s, del, d)) yield del;
      if (d.create(am, s.roles[r])) yield { kind: "role_clone", actor: id, role: r };
    }
    for (const mask of d.createMasks(am)) yield { kind: "role_create", actor: id, mask };
    if (s.inv === null) {
      for (const g of byMask(d.inviteGrants(am))) yield { kind: "invite_create", actor: id, ...g };
    } else {
      for (const kind of ["invite_reissue", "invite_cancel"] as const) {
        const op: Op = { kind, actor: id };
        if (allowed(s, op, d)) yield op;
      }
    }
  }
  if (s.inv !== null) {
    const op: Op = { kind: "accept", actor: `N${s.members.length}` };
    if (allowed(s, op, d)) yield op;
  }
}

function withRole(s: State, mask: number): [State, number] {
  return [{ ...s, roles: [...s.roles, mask] }, s.roles.length];
}
function setMember(s: State, id: string, f: (m: Member) => Member): State {
  return { ...s, members: s.members.map((m) => (m.id === id ? f(m) : m)) };
}

function apply(s: State, op: Op): State {
  switch (op.kind) {
    case "patch": {
      const [s1, r] = op.grantRole === null ? withRole(s, op.grantMask) : [s, op.grantRole];
      return setMember(s1, op.target, (m) => ({ ...m, role: r }));
    }
    case "remove":
      return setMember(s, op.target, (m) => ({ ...m, active: false, role: -1 }));
    case "reset":
      return s;
    case "role_update": {
      if (op.next === "unchanged") return s;
      const next = op.next;
      return { ...s, roles: s.roles.map((m, r) => (r === op.role ? next : m)) };
    }
    case "role_delete":
      return { ...s, roles: s.roles.map((m, r) => (r === op.role ? DELETED : m)) };
    case "role_clone":
      return withRole(s, s.roles[op.role])[0];
    case "role_create":
      return withRole(s, op.mask)[0];
    case "invite_create": {
      const [s1, r] = op.grantRole === null ? withRole(s, op.grantMask) : [s, op.grantRole];
      return { ...s1, inv: { role: r, issuer: op.actor } };
    }
    case "invite_reissue":
      return { ...s, inv: { ...s.inv!, issuer: op.actor } };
    case "invite_cancel":
      return { ...s, inv: null };
    case "accept": {
      const r = s.inv!.role;
      const joined: Member = { id: op.actor, owner: s.roles[r] === OWNER, active: true, role: r };
      return { ...s, members: [...s.members, joined], inv: null };
    }
  }
}

// ── enumeration of states ───────────────────────────────────────────────────
/** Restricted growth strings = set partitions of n items (shared roles). */
function* partitions(n: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === n) {
    yield prefix;
    return;
  }
  const max = prefix.length === 0 ? -1 : Math.max(...prefix);
  for (let b = 0; b <= max + 1; b++) yield* partitions(n, [...prefix, b]);
}
function* product(k: number): Generator<number[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (const rest of product(k - 1)) for (const m of MASKS) yield [...rest, m];
}
/** Owner + the given non-Owners: every active/revoked split × every sharing of roles × every mask per role. */
function* coreStates(ids: readonly string[], onlyAllActive = false): Generator<State> {
  for (let bits = onlyAllActive ? (1 << ids.length) - 1 : 0; bits < 1 << ids.length; bits++) {
    const act = ids.filter((_, i) => bits & (1 << i));
    for (const part of partitions(act.length)) {
      const blocks = part.length === 0 ? 0 : Math.max(...part) + 1;
      for (const masks of product(blocks)) {
        const members = ids.map((id): Member => {
          const j = act.indexOf(id);
          return j < 0
            ? { id, owner: false, active: false, role: -1 }
            : { id, owner: false, active: true, role: 1 + part[j] };
        });
        yield { members: [OWNER_MEMBER, ...members], roles: [OWNER, ...masks], inv: null };
      }
    }
  }
}

const P = ["P1", "P2", "P3"] as const;

/**
 * Every state of U-RB-18 paired with the ops to run on it. A state is core
 * (members + held roles) × an optional unheld role R_f × an optional pending
 * invitation (issuer = a non-Owner, active or not; an Owner-issued link is an
 * Owner op — out of scope §1.3). Factoring, exact rather than a sample: an op
 * that does not read R_f / the invitation has the same verdict and the same
 * effect on members whatever those hold, and U ignores both — so it runs once
 * per core state; ops on R_f run per R_f; invitation ops per invitation (on a
 * held role, the Owner role, or an unheld role of every mask). `fullProduct`
 * drops the factoring (R_f × invitation × every op) — the cross-check below.
 */
function* cases(fullProduct = false, every = 1): Generator<{ s: State; ops: Iterable<Op> }> {
  let i = 0;
  for (const core of coreStates(P)) {
    if (i++ % every !== 0) continue;
    if (fullProduct) {
      for (const s0 of [core, ...MASKS.map((m) => withRole(core, m)[0])]) {
        yield { s: s0, ops: opsOf(s0, P) };
        for (let r = 0; r < s0.roles.length; r++)
          for (const issuer of P) {
            const s = { ...s0, inv: { role: r, issuer } };
            yield { s, ops: opsOf(s, P) };
          }
      }
      continue;
    }
    yield { s: core, ops: opsOf(core, P) };
    for (const m of MASKS) {
      const [s, rf] = withRole(core, m);
      yield { s, ops: opsOf(s, P, { rf }) };
    }
    const invRoles: [State, number][] = [
      ...core.roles.map((_, r): [State, number] => [core, r]),
      ...MASKS.map((m) => withRole(core, m)),
    ];
    for (const [base, role] of invRoles) {
      for (const issuer of P) {
        const s = { ...base, inv: { role, issuer } };
        yield { s, ops: opsOf(s, P, "invitation") };
      }
    }
  }
}

// ── the property ────────────────────────────────────────────────────────────
interface Counterexample {
  readonly s: State;
  readonly op: Op;
  readonly t: string;
  readonly s2: State;
  /** Who can reset T after the op (non-empty — that is the violation). */
  readonly witnesses: string[];
}
const KINDS = [
  "patch_other",
  "patch_self",
  "remove_other",
  "remove_self",
  "reset",
  "role_update_held_by_other",
  "role_update_held_by_actor",
  "role_update_unheld",
  "role_update_unchanged",
  "role_update_noop",
  "role_delete",
  "role_create",
  "role_clone",
  "invite_create",
  "invite_reissue",
  "invite_cancel",
  "accept",
] as const;
type Kind = (typeof KINDS)[number];

function kindsOf(s: State, op: Op): Kind[] {
  switch (op.kind) {
    case "patch":
    case "remove":
      return [`${op.kind}_${op.actor === op.target ? "self" : "other"}` as Kind];
    case "role_update": {
      const out: Kind[] = [];
      const holders = s.members.filter((m) => m.active && m.role === op.role);
      if (holders.some((m) => m.id === op.actor)) out.push("role_update_held_by_actor");
      if (holders.some((m) => m.id !== op.actor)) out.push("role_update_held_by_other");
      if (holders.length === 0) out.push("role_update_unheld");
      if (op.next === "unchanged") out.push("role_update_unchanged");
      else if (op.next === s.roles[op.role]) out.push("role_update_noop");
      return out;
    }
    default:
      return [op.kind];
  }
}

interface Report {
  states: number;
  opsTried: number;
  passed: Record<Kind, number>;
  statesWithNonEmptyU: number;
  /** (T ∈ U(s), T ≠ actor, T active in s′) pairs actually checked. */
  checks: number;
  counterexamples: Counterexample[];
}

function runProperty(rules: Rules, opts: { fullProduct?: boolean; every?: number } = {}): Report {
  const d = new Decider(rules);
  const real = rules === REAL ? d : new Decider(REAL);
  const rep: Report = {
    states: 0,
    opsTried: 0,
    passed: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>,
    statesWithNonEmptyU: 0,
    checks: 0,
    counterexamples: [],
  };
  for (const { s, ops } of cases(opts.fullProduct, opts.every)) {
    rep.states++;
    const u = U(s);
    if (u.length > 0) rep.statesWithNonEmptyU++;
    assertUMeansNoReset(s, u, real);
    for (const op of ops) {
      rep.opsTried++;
      if (!allowed(s, op, d)) continue;
      for (const k of kindsOf(s, op)) rep.passed[k]++;
      const s2 = apply(s, op);
      for (const t of u) {
        if (t === op.actor) continue;
        const t2 = member(s2, t);
        if (!t2.active) continue;
        rep.checks++;
        const w = witnesses(s2, t2);
        if (w.length > 0) rep.counterexamples.push({ s, op, t, s2, witnesses: w });
      }
    }
  }
  return rep;
}

/**
 * assert 2 — ties U to the REAL reset gate: T ∈ U ⇒ every non-Owner's reset of
 * T is refused. And the converse (T ∉ U ⇒ some non-Owner may reset T), so U is
 * not trivially small and a too-strict reset rule cannot hide behind it.
 */
function assertUMeansNoReset(s: State, u: readonly string[], d: Decider) {
  for (const t of s.members.filter(isActor)) {
    const resetters = s.members
      .filter(isActor)
      .filter((y) => d.reset(maskIn(s, y), maskIn(s, t), y.id === t.id))
      .map((y) => y.id);
    if (u.includes(t.id) && resetters.length > 0) {
      throw new Error(`assert 2: ${t.id} ∈ U but reset by ${resetters} passes in ${fmt(s)}`);
    }
    if (!u.includes(t.id) && resetters.length === 0) {
      throw new Error(`U too small: ${t.id} ∉ U but nobody can reset it in ${fmt(s)}`);
    }
  }
}

function fmt(s: State): string {
  const ms = s.members
    .map((m) => (m.active ? `${m.id}:R${m.role}${show(s.roles[m.role])}` : `${m.id}:revoked`))
    .join(" ");
  const inv = s.inv ? ` inv(R${s.inv.role} by ${s.inv.issuer})` : "";
  return `[${ms}${inv}]`;
}
function fmtOp(op: Op): string {
  switch (op.kind) {
    case "patch":
      return `${op.actor} PATCH ${op.target} → ${op.grantRole === null ? "new role" : `R${op.grantRole}`}${show(op.grantMask)}`;
    case "role_update":
      return `${op.actor} UPDATE R${op.role} → ${op.next === "unchanged" ? "unchanged" : show(op.next)}`;
    default:
      return `${op.actor} ${op.kind} ${JSON.stringify(op)}`;
  }
}
const fmtCx = (c: Counterexample) =>
  `${fmt(c.s)}  ${fmtOp(c.op)}  ⇒ ${c.t} now resettable by ${c.witnesses.join(",")}  ${fmt(c.s2)}`;

// ── the tests ───────────────────────────────────────────────────────────────
describe("authority lemma — fixture", () => {
  it("X/Y are real, selectable, tier-all registry keys; no implies among the fixture keys", () => {
    for (const k of KEYS) {
      const def = CAPABILITY_REGISTRY.find((c) => c.key === k);
      expect(def, k).toBeDefined();
      expect(def!.selectable && def!.tier === "all").toBe(true);
    }
    // expansion of every fixture subset stays the subset (so ⊊ on masks = ⊊ on expanded sets)
    for (const m of MASKS) expect(EXP[m]).toBe(m);
    for (const m of MASKS) expect(VALIDATED[m]).not.toBeNull();
    expect(VALIDATED[OWNER]).toBeNull();
  });

  it("state enumeration: Owner + 3 non-Owners — 4831 core states (shared roles, active/revoked)", () => {
    expect([...coreStates(P)].length).toBe(4831);
  });
});

describe("U-RB-18 · property single-step (every state × every op of every non-Owner, real fns)", () => {
  it(
    "∀ T ∈ U(s), T ≠ actor, T active in s′ ⇒ T ∈ U(s′)  ·  T ∈ U ⇔ no non-Owner reset passes  ·  non-vacuity",
    () => {
      const t0 = performance.now();
      const rep = runProperty(REAL);
      const ms = Math.round(performance.now() - t0);
      console.log(
        `U-RB-18: ${rep.states} states · ${rep.opsTried} ops tried · ${rep.checks} (T∈U) checks · ` +
          `${rep.statesWithNonEmptyU} states with U≠∅ · ${ms} ms\n  passed by kind: ${JSON.stringify(rep.passed)}`,
      );
      expect(rep.counterexamples.slice(0, 3).map(fmtCx)).toEqual([]);
      // non-vacuity: every op kind really passed somewhere, U is non-empty somewhere, checks ran
      for (const k of KINDS)
        expect(rep.passed[k], `no allowed ${k} — the model does not cover it`).toBeGreaterThan(0);
      expect(rep.statesWithNonEmptyU).toBeGreaterThan(0);
      expect(rep.checks).toBeGreaterThan(0);
    },
    SLOW,
  );

  it(
    "factoring check: on a deterministic slice of core states, the full product (R_f × invitation × every op) agrees",
    () => {
      const rep = runProperty(REAL, { fullProduct: true, every: 97 });
      console.log(
        `U-RB-18 full-product slice: ${rep.states} states · ${rep.opsTried} ops · ${rep.checks} checks`,
      );
      expect(rep.counterexamples.slice(0, 3).map(fmtCx)).toEqual([]);
      expect(rep.checks).toBeGreaterThan(0);
    },
    SLOW,
  );
});

/**
 * The counterexample shape each control must produce — one rule = one leg of
 * the proof. `every` must hold for EVERY counterexample (a control that goes
 * red for another reason proves nothing about its leg); `some` is the textbook
 * form from §1.3/§13.6, which must be among them.
 */
interface Shape {
  readonly every: (c: Counterexample) => string | null;
  readonly some: (c: Counterexample) => boolean;
  readonly someLabel: string;
}
const realReset = new Decider(REAL);
const resetPasses = (s: State, by: string, t: string) =>
  realReset.reset(maskIn(s, member(s, by)), maskIn(s, member(s, t)), by === t);
const SHAPE: Record<ControlName, Shape> = {
  // c1: an actor (holding manage_members) lowers a role EQUAL to itself that T holds.
  c1: {
    every: (c) => {
      const { op, s } = c;
      if (op.kind !== "role_update" || op.next === "unchanged") return "not a role update";
      const a = maskIn(s, member(s, op.actor));
      if (!holdsMM(a)) return "editor lacks manage_members (that is c3's leg)";
      if (s.roles[op.role] !== a) return "role was not equal to the actor";
      if (!strictlyBelow(op.next, a)) return "not a lowering";
      if (member(s, c.t).role !== op.role) return "T does not hold the edited role";
      return null;
    },
    some: (c) => resetPasses(c.s2, c.op.actor, c.t),
    someLabel:
      "ONE actor: lower the equal role, then the same actor resets T (real decideAdminReset)",
  },
  // c2: PATCH moves T (not ⊊ actor before) and a real reset of T then passes.
  c2: {
    every: (c) => {
      const { op, s } = c;
      if (op.kind !== "patch" || op.target !== c.t || op.actor === c.t)
        return "not a PATCH of T by another";
      if (strictlyBelow(maskIn(s, member(s, c.t)), maskIn(s, member(s, op.actor))))
        return "T was already below the actor";
      if (!c.witnesses.some((w) => resetPasses(c.s2, w, c.t))) return "no real reset afterwards";
      return null;
    },
    some: (c) =>
      c.op.kind === "patch" &&
      strictlyBelow(c.op.grantMask, maskIn(c.s, member(c.s, c.op.actor))) &&
      resetPasses(c.s2, c.op.actor, c.t),
    someLabel: "PATCH-lower T below the actor, then the actor resets T",
  },
  // c3: M without manage_members edits T's role; a DIFFERENT non-Owner A becomes the resetter.
  c3: {
    every: (c) => {
      const { op, s } = c;
      if (op.kind !== "role_update") return "not a role update";
      if (holdsMM(maskIn(s, member(s, op.actor)))) return "editor holds manage_members";
      if (member(s, c.t).role !== op.role) return "T does not hold the edited role";
      if (!c.witnesses.some((w) => w !== op.actor && w !== c.t && resetPasses(c.s2, w, c.t)))
        return "no second non-Owner whose real reset passes";
      return null;
    },
    some: (c) =>
      maskIn(c.s, member(c.s, c.op.actor)) === (MR | XB | YB) &&
      maskIn(c.s, member(c.s, c.t)) === XB &&
      c.op.kind === "role_update" &&
      c.op.next === YB &&
      c.witnesses.some((w) => maskIn(c.s, member(c.s, w)) === (MM | YB)),
    someLabel: "§1.3 M/A: M={mr,X,Y} edits R_T {X}→{Y}, A={mm,Y} resets T",
  },
  // c4: the actor PATCHes ITSELF to a role ⊄ its own and becomes T's resetter.
  c4: {
    every: (c) => {
      const { op, s } = c;
      if (op.kind !== "patch" || op.target !== op.actor) return "not a PATCH of yourself";
      const a = maskIn(s, member(s, op.actor));
      if ((EXP[op.grantMask] & EXP[a]) === EXP[op.grantMask]) return "not a raise beyond the actor";
      if (!c.witnesses.includes(op.actor)) return "the self-raiser is not the resetter";
      return null;
    },
    some: (c) => resetPasses(c.s2, c.op.actor, c.t),
    someLabel: "the self-raiser then resets T",
  },
};

describe("U-RB-19 · controls c1–c4 — each disabled leg turns the property red with ITS counterexample shape", () => {
  it.each(Object.keys(CONTROLS) as ControlName[])(
    "%s",
    (name) => {
      const rep = runProperty(CONTROLS[name]);
      const shape = SHAPE[name];
      const textbook = rep.counterexamples.find(shape.some);
      console.log(
        `U-RB-19 ${name}: ${rep.counterexamples.length} counterexamples · ${shape.someLabel}:\n  ` +
          (textbook ? fmtCx(textbook) : "(none)"),
      );
      expect(rep.counterexamples.length, `${name} did not turn the property red`).toBeGreaterThan(
        0,
      );
      const wrongShape = rep.counterexamples
        .map((c) => [shape.every(c), c] as const)
        .filter(([why]) => why !== null)
        .slice(0, 3)
        .map(([why, c]) => `${why}: ${fmtCx(c)}`);
      expect(wrongShape).toEqual([]);
      expect(textbook, shape.someLabel).toBeDefined();
    },
    SLOW,
  );
});

// ── U-RB-20 · BFS ───────────────────────────────────────────────────────────
/**
 * Canonical form: renumber roles by first use and drop unreferenced unheld
 * roles — an unheld role of every mask is always available as a grant (any
 * number of them may exist at the start, created by the Owner), so keeping
 * them would only split equal states.
 */
function canonical(s: State): { key: string; s: State } {
  const map = new Map<number, number>([[0, 0]]);
  const roles = [OWNER];
  const ref = (r: number) => {
    let n = map.get(r);
    if (n === undefined) {
      n = roles.length;
      roles.push(s.roles[r]); // may be DELETED (an invitation whose role is gone)
      map.set(r, n);
    }
    return n;
  };
  const members = s.members.map((m) =>
    m.active ? { ...m, role: ref(m.role) } : { ...m, role: -1 },
  );
  const inv = s.inv ? { role: ref(s.inv.role), issuer: s.inv.issuer } : null;
  const key =
    members.map((m) => (m.active ? m.role : "x")).join(",") +
    "|" +
    roles.join(",") +
    "|" +
    (inv ? `${inv.role}@${inv.issuer}` : "-");
  return { key, s: { members, roles, inv } };
}

interface BfsResult {
  starts: number;
  /** Distinct states stored (depth < maxDepth). */
  visited: number;
  /** Successors at the last level — reset-checked, not stored. */
  lastLevelChecked: number;
  /** Shortest find: a state where some non-Owner's REAL reset of T passes. */
  hit: { depth: number; path: string[]; resetBy: string } | null;
}

/** Some active non-Owner other than T whose REAL `decideAdminReset` of T passes. */
function resetterOfT(s: State, real: Decider): string | null {
  const t = member(s, "T");
  if (!t.active) return null;
  const by = s.members.find(
    (y) => isActor(y) && y.id !== "T" && real.reset(maskIn(s, y), maskIn(s, t), false),
  );
  return by ? by.id : null;
}

/**
 * Multi-source BFS from every start (Owner + A, M, T active, every sharing ×
 * every mask) with T ∈ U, over the allowed ops of A and M (same op set as
 * U-RB-18, accept by a new user included). The reset is checked on every state
 * reached within `maxDepth` ops; the last level is checked without being stored.
 */
function bfs(rules: Rules, maxDepth: number, stopAtFirst: boolean): BfsResult {
  const d = new Decider(rules);
  const real = new Decider(REAL);
  const parent = new Map<string, { from: string | null; op: string; s: State }>();
  let frontier: string[] = [];
  let starts = 0;
  let lastLevelChecked = 0;
  for (const s0 of coreStates(["A", "M", "T"], true)) {
    if (!U(s0).includes("T")) continue;
    const { key, s } = canonical(s0);
    if (parent.has(key)) continue;
    parent.set(key, { from: null, op: `start ${fmt(s)}`, s });
    frontier.push(key);
    starts++;
  }
  const pathTo = (key: string) => {
    const out: string[] = [];
    for (let k: string | null = key; k !== null; k = parent.get(k)!.from)
      out.unshift(parent.get(k)!.op);
    return out;
  };
  let hit: BfsResult["hit"] = null;
  const found = (depth: number, path: string[], resetBy: string) => {
    if (hit === null || depth < hit.depth) hit = { depth, path, resetBy };
  };
  for (const key of frontier) {
    const by = resetterOfT(parent.get(key)!.s, real);
    if (by) found(0, pathTo(key), by);
  }
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    if (stopAtFirst && hit) break;
    const next: string[] = [];
    const last = depth + 1 === maxDepth;
    for (const key of frontier) {
      const s = parent.get(key)!.s;
      if (!member(s, "T").active) continue; // T gone: nothing left to reach
      for (const op of allowedOps(s, ["A", "M"], d)) {
        const s2 = apply(s, op);
        const by = resetterOfT(s2, real);
        if (by) found(depth + 1, [...pathTo(key), fmtOp(op)], by);
        if (last) {
          lastLevelChecked++;
          continue;
        }
        const c = canonical(s2);
        if (parent.has(c.key)) continue;
        parent.set(c.key, { from: key, op: fmtOp(op), s: c.s });
        next.push(c.key);
      }
    }
    frontier = next;
  }
  return { starts, visited: parent.size, lastLevelChecked, hit };
}

describe("U-RB-20 · BFS — 2 non-Owner actors (A, M) + T, same op set, depth 4", () => {
  it(
    "allowedOps ≡ opsOf ∩ allowed, for the real fns and every control (the BFS walks the U-RB-18 op set)",
    () => {
      const norm = (op: Op) => JSON.stringify(op, Object.keys(op).sort());
      let compared = 0;
      let i = 0;
      for (const s0 of coreStates(["A", "M", "T"])) {
        if (i++ % 29 !== 0) continue;
        const variants = [s0, { ...s0, inv: { role: s0.roles.length - 1, issuer: "A" } }];
        for (const s of variants) {
          for (const rules of [REAL, ...Object.values(CONTROLS)]) {
            const d = new Decider(rules);
            const plain = [...opsOf(s, ["A", "M"])]
              .filter((op) => allowed(s, op, d))
              .map(norm)
              .sort();
            const fast = [...allowedOps(s, ["A", "M"], d)].map(norm).sort();
            expect(fast).toEqual(plain);
            compared += plain.length;
          }
        }
      }
      expect(compared).toBeGreaterThan(1000);
    },
    SLOW,
  );

  it(
    "from every start with T ∈ U, no state within 4 ops lets any non-Owner reset T (real decideAdminReset)",
    () => {
      const t0 = performance.now();
      const r = bfs(REAL, 4, false);
      const ms = Math.round(performance.now() - t0);
      console.log(
        `U-RB-20: ${r.starts} starts · ${r.visited} states stored (depth ≤ 3) · ` +
          `${r.lastLevelChecked} depth-4 successors checked · ${ms} ms`,
      );
      const hit = r.hit as BfsResult["hit"];
      expect(hit && `${hit.path.join("  →  ")}  →  ${hit.resetBy} resets T`).toBeNull();
      expect(r.starts).toBeGreaterThan(0);
      expect(r.visited).toBeGreaterThan(r.starts);
      expect(r.lastLevelChecked).toBeGreaterThan(r.visited);
    },
    SLOW,
  );

  it.each(["c1", "c2", "c3", "c4"] as const)(
    "control %s finds a path (≤ 3 ops incl. the reset)",
    (name) => {
      const r = bfs(CONTROLS[name], 4, true);
      const hit = r.hit as BfsResult["hit"];
      console.log(`U-RB-20 ${name}: ${hit?.path.join("  →  ")}  →  ${hit?.resetBy} resets T`);
      expect(hit).not.toBeNull();
      expect(hit!.depth + 1).toBeLessThanOrEqual(3);
      const steps = hit!.path.slice(1);
      const by = hit!.resetBy;
      // the path's shape, per control (same legs as U-RB-19)
      if (name === "c1")
        expect(steps).toContainEqual(expect.stringMatching(new RegExp(`^${by} UPDATE`)));
      if (name === "c2")
        expect(steps).toContainEqual(expect.stringMatching(new RegExp(`^${by} PATCH T `)));
      if (name === "c3") {
        expect(steps).toContainEqual(expect.stringMatching(/^[AM] UPDATE/));
        const editors = steps.filter((p) => /^[AM] UPDATE/.test(p));
        expect(editors.every((p) => !p.startsWith(by))).toBe(true);
      }
      if (name === "c4")
        expect(steps).toContainEqual(expect.stringMatching(new RegExp(`^${by} PATCH ${by} `)));
    },
    SLOW,
  );
});
