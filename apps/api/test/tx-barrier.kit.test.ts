// T-003-B26b — unit test of the barrier kit itself (no DB). A barrier that
// silently never pauses would make every IC3 case "pass" as a sequential run,
// so each point is proven to (1) stop exactly where it says, (2) hand back the
// pid, (3) fire once, and (4) leave every other user's transaction alone.
import { describe, it, expect } from "vitest";
import { TxBarrier, within } from "./tx-barrier.kit";

function fakeClient(log: string[]) {
  const tx = {
    $queryRawUnsafe: async (sql: string) => {
      if (/pg_backend_pid/.test(sql)) return [{ pid: 42 }];
      log.push(`sql:${sql.trim().split(/\s+/).slice(0, 2).join(" ")}`);
      return [{ id: "org" }];
    },
    invitation: {
      create: async () => {
        log.push("invitation.create");
        return { id: "inv" };
      },
    },
  };
  return {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      log.push("BEGIN");
      const out = await fn(tx);
      log.push("COMMIT");
      return out;
    },
  };
}

/** What a service under `runInOrgLockTransaction` does: lock first, then work. */
const work = (client: ReturnType<typeof fakeClient>) =>
  client.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE');
    await tx.invitation.create();
    await tx.invitation.create();
    return "done";
  });

describe("TxBarrier (test kit)", () => {
  const cases = [
    { point: { at: "beforeTx" } as const, before: [], pid: 0 },
    { point: { at: "afterOrgLock" } as const, before: ["BEGIN", "sql:SELECT id"], pid: 42 },
    {
      point: { at: "beforeCall", model: "invitation", method: "create" } as const,
      before: ["BEGIN", "sql:SELECT id"],
      pid: 42,
    },
    {
      point: { at: "afterCall", model: "invitation", method: "create" } as const,
      before: ["BEGIN", "sql:SELECT id", "invitation.create"],
      pid: 42,
    },
    {
      point: { at: "beforeCommit" } as const,
      before: ["BEGIN", "sql:SELECT id", "invitation.create", "invitation.create"],
      pid: 42,
    },
  ];

  for (const c of cases) {
    it(`${c.point.at}: stops exactly there, reports the pid, then finishes once released`, async () => {
      const log: string[] = [];
      const barrier = new TxBarrier();
      const client = barrier.wrap(fakeClient(log), () => "u1");
      const gate = barrier.arm("u1", c.point);
      const running = work(client);
      expect(await within(gate.reached, 1_000, "the pause")).toBe(c.pid);
      expect(log).toEqual(c.before);
      expect(gate.claimed).toBe(true);
      gate.release();
      expect(await running).toBe("done");
      expect(log).toEqual([
        "BEGIN",
        "sql:SELECT id",
        "invitation.create",
        "invitation.create",
        "COMMIT",
      ]);
    });
  }

  it("is one-shot and per user: another user's tx and the same user's NEXT tx run straight through", async () => {
    const log: string[] = [];
    let who = "u2";
    const barrier = new TxBarrier();
    const client = barrier.wrap(fakeClient(log), () => who);
    const gate = barrier.arm("u1", { at: "afterOrgLock" });
    expect(await work(client)).toBe("done"); // u2 — untouched
    expect(gate.claimed).toBe(false);
    who = "u1";
    const first = work(client);
    await within(gate.reached, 1_000, "u1's first tx");
    gate.release();
    await first;
    expect(await within(work(client), 1_000, "u1's second tx must not pause")).toBe("done");
  });

  it("failWith throws at the pause point — the callback never reaches COMMIT", async () => {
    const log: string[] = [];
    const barrier = new TxBarrier();
    const client = barrier.wrap(fakeClient(log), () => "u1");
    const gate = barrier.arm("u1", { at: "afterCall", model: "invitation", method: "create" });
    const running = work(client);
    await within(gate.reached, 1_000, "the pause");
    gate.failWith(new Error("boom after the write"));
    await expect(running).rejects.toThrow("boom after the write");
    expect(log).not.toContain("COMMIT");
  });

  it("reset() releases a gate nobody released (no hung request after a failed test)", async () => {
    const barrier = new TxBarrier();
    const client = barrier.wrap(fakeClient([]), () => "u1");
    const gate = barrier.arm("u1", { at: "beforeCommit" });
    const running = work(client);
    await within(gate.reached, 1_000, "the pause");
    barrier.reset();
    expect(await running).toBe("done");
  });
});
