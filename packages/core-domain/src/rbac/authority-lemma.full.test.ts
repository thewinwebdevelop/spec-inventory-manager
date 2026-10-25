// F-003 · T-003-QA07 ★ — the authority lemma, FULL tier: U-RB-20 BFS (2
// non-Owner actors A, M + T, same op set as U-RB-18). Excluded from the default
// `vitest run`; runs via `pnpm --filter @omnistock/core-domain test:full`
// (CI node-ci, guarded by tool/ci/assert-tests-ran.mjs). test-plan §2.4 / §7.
import { describe, it, expect } from "vitest";
import {
  CONTROLS,
  Decider,
  REAL,
  allowed,
  allowedOps,
  bfs,
  coreStates,
  opsOf,
  PENDING_DEPTH,
  type BfsResult,
  type Op,
} from "../../test/authority-lemma.harness";

/** Exhaustive runs take seconds, not ms — explicit per-test budget. */
const SLOW = 300_000;

describe("U-RB-20 · BFS — 2 non-Owner actors (A, M) + T, same op set, depth 4", () => {
  it(
    "allowedOps ≡ opsOf ∩ allowed, for the real fns and every control (the BFS walks the U-RB-18 op set)",
    () => {
      const norm = (op: Op) => JSON.stringify(op, Object.keys(op).sort());
      let compared = 0;
      let i = 0;
      for (const s0 of coreStates(["A", "M", "T"])) {
        if (i++ % 29 !== 0) continue;
        const variants = [
          s0,
          { ...s0, inv: { role: s0.roles.length - 1, issuer: "A" } },
          { ...s0, inv: { role: 0, issuer: "M" } },
        ];
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
    "from every start with T ∈ U, no state within 4 ops lets any non-Owner reset T, and the Owner set never changes",
    () => {
      const t0 = performance.now();
      const r = bfs(REAL, 4, false);
      const ms = Math.round(performance.now() - t0);
      console.log(
        `U-RB-20: ${r.starts} starts · ${r.visited} states stored (depth ≤ 3) · ` +
          `${r.lastLevelChecked} depth-4 successors checked · ${ms} ms`,
      );
      const hit = r.hit as BfsResult["hit"];
      const ownerHit = r.ownerHit as BfsResult["ownerHit"];
      expect(hit && `${hit.path.join("  →  ")}  →  ${hit.resetBy} resets T`).toBeNull();
      expect(ownerHit && `${ownerHit.path.join("  →  ")}  ⇒ Owner set changed`).toBeNull();
      expect(r.starts).toBeGreaterThan(0);
      expect(r.visited).toBeGreaterThan(r.starts);
      expect(r.lastLevelChecked).toBeGreaterThan(r.visited);
    },
    SLOW,
  );

  it(
    `pending-invitation starts (issuer A or M, any role): same two checks within ${PENDING_DEPTH} ops`,
    () => {
      const t0 = performance.now();
      const r = bfs(REAL, PENDING_DEPTH, false, "pending-invitation");
      const ms = Math.round(performance.now() - t0);
      console.log(
        `U-RB-20 pending-invitation: ${r.starts} starts · ${r.visited} states stored · ` +
          `${r.lastLevelChecked} depth-${PENDING_DEPTH} successors checked · ${ms} ms`,
      );
      const hit = r.hit as BfsResult["hit"];
      const ownerHit = r.ownerHit as BfsResult["ownerHit"];
      expect(hit && `${hit.path.join("  →  ")}  →  ${hit.resetBy} resets T`).toBeNull();
      expect(ownerHit && `${ownerHit.path.join("  →  ")}  ⇒ Owner set changed`).toBeNull();
      expect(r.starts).toBeGreaterThan(0);
      expect(r.lastLevelChecked).toBeGreaterThan(r.visited);
    },
    SLOW,
  );

  it.each(["c1", "c2", "c3", "c4", "c5"] as const)(
    "control %s finds a reset path (≤ 3 ops incl. the reset)",
    (name) => {
      const r =
        name === "c5"
          ? bfs(CONTROLS[name], PENDING_DEPTH, "reset", "pending-invitation")
          : bfs(CONTROLS[name], 4, "reset");
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
      if (name === "c5") {
        // the joiner through the stale link is the resetter
        expect(by).toMatch(/^N\d+$/);
        expect(steps).toContainEqual(`${by} ACCEPT`);
      }
    },
    SLOW,
  );

  it.each(["o1", "o2"] as const)(
    "control %s finds a path that adds an Owner",
    (name) => {
      const r =
        name === "o1"
          ? bfs(CONTROLS[name], PENDING_DEPTH, "owner", "pending-invitation")
          : bfs(CONTROLS[name], 4, "owner");
      const ownerHit = r.ownerHit as BfsResult["ownerHit"];
      console.log(`U-RB-20 ${name}: ${ownerHit?.path.join("  →  ")}  ⇒ Owner set changed`);
      expect(ownerHit).not.toBeNull();
      const lastStep = ownerHit!.path[ownerHit!.path.length - 1];
      if (name === "o1") expect(lastStep).toMatch(/^N\d+ ACCEPT$/);
      if (name === "o2") expect(lastStep).toMatch(/^[AM] PATCH [AMT] → R0\{full_access\}$/);
    },
    SLOW,
  );
});
