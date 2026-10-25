// F-003 · T-003-QA07 ★ — the authority lemma, default (smoke) run: U-RB-18
// property single-step + U-RB-19 controls c1–c5 / o1 / o2. The state model,
// U, the controls and the BFS live in test/authority-lemma.harness.ts;
// U-RB-20 (BFS) runs in authority-lemma.full.test.ts (`test:full` lane).
// architecture §1.3 "เหตุผลเชิงรูปแบบ" · §13.6 · test-plan §2.4.
import { describe, it, expect } from "vitest";
import { CAPABILITY_REGISTRY } from "./registry";
import {
  CONTROLS,
  Decider,
  EXP,
  KEYS,
  KINDS,
  MASKS,
  MM,
  MR,
  OWNER,
  P,
  REAL,
  VALIDATED,
  XB,
  YB,
  coreStates,
  fmtCx,
  fmtOwnerChange,
  holdsMM,
  maskIn,
  member,
  runProperty,
  strictlyBelow,
  type ControlName,
  type Counterexample,
  type OwnerChange,
  type State,
} from "../../test/authority-lemma.harness";

/** Exhaustive runs take seconds, not ms — explicit per-test budget. */
const SLOW = 300_000;

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
          `${rep.statesWithNonEmptyU} states with U≠∅ · ${rep.ownerAttempts} Owner-adding + ${rep.ownerTouchAttempts} Owner-targeting attempts · ${ms} ms\n` +
          `  passed by kind: ${JSON.stringify(rep.passed)}`,
      );
      expect(rep.counterexamples.slice(0, 3).map(fmtCx)).toEqual([]);
      // assert 3 (D-030): the SET of Owner-role holders is unchanged by every non-Owner op (no add,
      // no demotion, no removal) — and both directions were really tried
      expect(rep.ownerChanges.slice(0, 3).map(fmtOwnerChange)).toEqual([]);
      expect(rep.ownerAttempts).toBeGreaterThan(0);
      expect(rep.ownerTouchAttempts).toBeGreaterThan(0);
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
      expect(rep.ownerChanges.slice(0, 3).map(fmtOwnerChange)).toEqual([]);
      expect(rep.checks).toBeGreaterThan(0);
    },
    SLOW,
  );
});

/**
 * The counterexample shape each control must produce — one rule = one leg of
 * the proof. A finding is either an assert-1 counterexample (T left U) or an
 * assert-3 Owner mint. `every` must hold for EVERY finding (a control that goes
 * red for another reason proves nothing about its leg); `some` is the textbook
 * form from §1.3/§13.6, which must be among them.
 */
type Finding =
  | { readonly kind: "reset"; readonly cx: Counterexample }
  | { readonly kind: "owner"; readonly m: OwnerChange };
const fmtFinding = (f: Finding) => (f.kind === "reset" ? fmtCx(f.cx) : fmtOwnerChange(f.m));
interface Shape {
  readonly every: (f: Finding) => string | null;
  readonly some: (f: Finding) => boolean;
  readonly someLabel: string;
}
const realReset = new Decider(REAL);
const resetPasses = (s: State, by: string, t: string) =>
  realReset.reset(maskIn(s, member(s, by)), maskIn(s, member(s, t)), by === t);
/** A leg of the reset argument: Owner mints are a DIFFERENT leg, so they are a wrong shape here. */
const onReset =
  <R>(f: (c: Counterexample) => R, ownerAnswer: R) =>
  (x: Finding): R =>
    x.kind === "reset" ? f(x.cx) : ownerAnswer;
/** An Owner-set leg: a reset counterexample is a wrong shape here. */
const onOwner =
  <R>(f: (m: OwnerChange) => R, resetAnswer: R) =>
  (x: Finding): R =>
    x.kind === "owner" ? f(x.m) : resetAnswer;
const MINTED = "the Owner set changed (that is o1/o2's leg)";
const issuerOf = (s: State) => member(s, s.inv!.issuer);

const SHAPE: Record<ControlName, Shape> = {
  // c1: an actor (holding manage_members) lowers a role EQUAL to itself that T holds.
  c1: {
    every: onReset((c) => {
      const { op, s } = c;
      if (op.kind !== "role_update" || op.next === "unchanged") return "not a role update";
      const a = maskIn(s, member(s, op.actor));
      if (!holdsMM(a)) return "editor lacks manage_members (that is c3's leg)";
      if (s.roles[op.role] !== a) return "role was not equal to the actor";
      if (!strictlyBelow(op.next, a)) return "not a lowering";
      if (member(s, c.t).role !== op.role) return "T does not hold the edited role";
      return null;
    }, MINTED),
    some: onReset((c) => resetPasses(c.s2, c.op.actor, c.t), false),
    someLabel:
      "ONE actor: lower the equal role, then the same actor resets T (real decideAdminReset)",
  },
  // c2: PATCH moves T (not ⊊ actor before) and a real reset of T then passes.
  c2: {
    every: onReset((c) => {
      const { op, s } = c;
      if (op.kind !== "patch" || op.target !== c.t || op.actor === c.t)
        return "not a PATCH of T by another";
      if (strictlyBelow(maskIn(s, member(s, c.t)), maskIn(s, member(s, op.actor))))
        return "T was already below the actor";
      if (!c.witnesses.some((w) => resetPasses(c.s2, w, c.t))) return "no real reset afterwards";
      return null;
    }, MINTED),
    some: onReset(
      (c) =>
        c.op.kind === "patch" &&
        strictlyBelow(c.op.grantMask, maskIn(c.s, member(c.s, c.op.actor))) &&
        resetPasses(c.s2, c.op.actor, c.t),
      false,
    ),
    someLabel: "PATCH-lower T below the actor, then the actor resets T",
  },
  // c3: M without manage_members edits T's role; a DIFFERENT non-Owner A becomes the resetter.
  c3: {
    every: onReset((c) => {
      const { op, s } = c;
      if (op.kind !== "role_update") return "not a role update";
      if (holdsMM(maskIn(s, member(s, op.actor)))) return "editor holds manage_members";
      if (member(s, c.t).role !== op.role) return "T does not hold the edited role";
      if (!c.witnesses.some((w) => w !== op.actor && w !== c.t && resetPasses(c.s2, w, c.t)))
        return "no second non-Owner whose real reset passes";
      return null;
    }, MINTED),
    some: onReset(
      (c) =>
        maskIn(c.s, member(c.s, c.op.actor)) === (MR | XB | YB) &&
        maskIn(c.s, member(c.s, c.t)) === XB &&
        c.op.kind === "role_update" &&
        c.op.next === YB &&
        c.witnesses.some((w) => maskIn(c.s, member(c.s, w)) === (MM | YB)),
      false,
    ),
    someLabel: "§1.3 M/A: M={mr,X,Y} edits R_T {X}→{Y}, A={mm,Y} resets T",
  },
  // c4: the actor PATCHes ITSELF to a role ⊄ its own and becomes T's resetter.
  c4: {
    every: onReset((c) => {
      const { op, s } = c;
      if (op.kind !== "patch" || op.target !== op.actor) return "not a PATCH of yourself";
      const a = maskIn(s, member(s, op.actor));
      if ((EXP[op.grantMask] & EXP[a]) === EXP[op.grantMask]) return "not a raise beyond the actor";
      if (!c.witnesses.includes(op.actor)) return "the self-raiser is not the resetter";
      return null;
    }, MINTED),
    some: onReset((c) => resetPasses(c.s2, c.op.actor, c.t), false),
    someLabel: "the self-raiser then resets T",
  },
  // c5: a new member joins through an issuer who lost the floor or no longer covers the role.
  // (An Owner-role link by a non-Owner also gets through — the same leg, seen as an Owner mint.)
  c5: {
    every: (f) => {
      const { s, op } = f.kind === "reset" ? f.cx : f.m;
      if (op.kind !== "accept") return "not an accept";
      const issuer = issuerOf(s);
      if (!issuer.active || issuer.owner) return "issuer not an active non-Owner";
      const role = s.roles[s.inv!.role];
      const covers = role !== OWNER && (EXP[role] & EXP[maskIn(s, issuer)]) === EXP[role];
      if (holdsMM(maskIn(s, issuer)) && covers) return "issuer still passes D-035";
      if (f.kind === "reset" && !f.cx.witnesses.includes(op.actor))
        return "the new member is not the resetter";
      return null;
    },
    some: onReset(
      (c) => !holdsMM(maskIn(c.s, issuerOf(c.s))) && resetPasses(c.s2, c.op.actor, c.t),
      false,
    ),
    someLabel: "Addendum P2: issuer lost manage_members, the new member resets T",
  },
  // o1: a non-Owner's link to the Owner role is accepted → a new Owner.
  o1: {
    every: onOwner((m) => {
      if (m.op.kind !== "accept") return "not an accept";
      if (m.s.roles[m.s.inv!.role] !== OWNER) return "invitation role is not the Owner role";
      if (issuerOf(m.s).owner) return "issued by the Owner (out of scope)";
      return null;
    }, "a reset counterexample (not the Owner-set leg)"),
    some: onOwner(() => true, false),
    someLabel: "non-Owner's Owner-role link accepted ⇒ one more Owner",
  },
  // o2: a non-Owner PATCHes a member (itself included) to the Owner role.
  o2: {
    every: onOwner((m) => {
      if (m.op.kind !== "patch" || m.op.grantMask !== OWNER) return "not a PATCH to the Owner role";
      if (member(m.s, m.op.actor).owner) return "actor is the Owner";
      return null;
    }, "a reset counterexample (not the Owner-set leg)"),
    some: onOwner((m) => m.op.kind === "patch" && m.op.actor === m.op.target, false),
    someLabel: "non-Owner PATCHes ITSELF to the Owner role",
  },
};

describe("U-RB-19 · controls c1–c5 + o1/o2 — each disabled leg turns the property red with ITS counterexample shape", () => {
  it.each(Object.keys(CONTROLS) as ControlName[])(
    "%s",
    (name) => {
      const rep = runProperty(CONTROLS[name]);
      const shape = SHAPE[name];
      const findings: Finding[] = [
        ...rep.counterexamples.map((cx): Finding => ({ kind: "reset", cx })),
        ...rep.ownerChanges.map((m): Finding => ({ kind: "owner", m })),
      ];
      const textbook = findings.find(shape.some);
      console.log(
        `U-RB-19 ${name}: ${rep.counterexamples.length} counterexamples · ${rep.ownerChanges.length} Owner-set changes · ` +
          `${shape.someLabel}:\n  ${textbook ? fmtFinding(textbook) : "(none)"}`,
      );
      expect(findings.length, `${name} did not turn the property red`).toBeGreaterThan(0);
      const wrongShape = findings
        .map((f) => [shape.every(f), f] as const)
        .filter(([why]) => why !== null)
        .slice(0, 3)
        .map(([why, f]) => `${why}: ${fmtFinding(f)}`);
      expect(wrongShape).toEqual([]);
      expect(textbook, shape.someLabel).toBeDefined();
    },
    SLOW,
  );
});
