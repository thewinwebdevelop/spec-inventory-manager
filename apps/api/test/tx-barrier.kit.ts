// F-003 · T-003-B26a/B26b — a REAL barrier for org-locked transactions.
//
// IC-B24 / IC-B25 each grew a private proxy around `RolesService`'s client.
// B26b needs the same thing on FIVE services at once (roles, members,
// invitations create / accept, and the ordering between them), and in more
// places than "after the Role write": before the transaction opens (SR-08 —
// "passed the guard, not yet locked"), right after the org lock is granted
// (to serialize two requests in a known order), before / after one Prisma
// call (to let a lock-skipping SQL writer in between a check and its write),
// and just before COMMIT.
//
// HOW: `ORG_PRISMA` is re-provided as `barrier.wrap(<the real org proxy>)`.
// Production code is untouched — every service still gets "the" org client,
// it just happens to be one that can be told to stop. A pause is ARMED for one
// user id; the first org-locked transaction that user's request opens claims
// it (one-shot), so every other request in the app runs straight through.
//
// WHY THIS IS NOT A SLEEP. Every pause is a promise the test resolves after it
// has OBSERVED the state it needs (the paused tx holds a pid; another backend
// is blocked on that pid in `pg_blocking_pids`; the competing request has
// answered). The only loop is `waitUntilBlockedBy` — it polls for a CONDITION
// and fails loudly when the condition never arrives, it never waits "long
// enough" for anything.
//
// ⚠ A paused transaction keeps its Prisma interactive-tx clock running
// (`ORG_TX_TIMEOUTS.txTimeoutMs`) and a waiter behind it keeps its
// `lock_timeout` running — release promptly; never hold across an `await` that
// is not part of the race.

/** Where in a transaction (or before it) the armed request stops. */
export type BarrierPoint =
  /** Before `$transaction` is even called — the request is past every guard, holds no lock. */
  | { readonly at: "beforeTx" }
  /** Right after `SELECT … FROM "Organization" … FOR UPDATE` returned — holds the org lock. */
  | { readonly at: "afterOrgLock" }
  /** Right before `tx.<model>.<method>(…)` is called (the first such call in the tx). */
  | { readonly at: "beforeCall"; readonly model: string; readonly method: string }
  /** Right after `tx.<model>.<method>(…)` returned (the first such call in the tx). */
  | { readonly at: "afterCall"; readonly model: string; readonly method: string }
  /** The callback returned; COMMIT has not been sent — holds every lock the tx took. */
  | { readonly at: "beforeCommit" };

export interface Gate {
  /** Resolves with the paused transaction's backend pid (0 for `beforeTx`: no tx yet). */
  readonly reached: Promise<number>;
  /** Let the paused request continue. Idempotent. */
  release(): void;
  /** Continue by THROWING `error` at the pause point (inside the tx ⇒ rollback). */
  failWith(error: Error): void;
  /** True once a transaction claimed this gate. */
  readonly claimed: boolean;
}

interface Entry {
  readonly userId: string;
  readonly point: BarrierPoint;
  claimed: boolean;
  reach: (pid: number) => void;
  readonly go: Promise<Error | null>;
  resume: (outcome: Error | null) => void;
}

type AnyFn = (...args: unknown[]) => unknown;
type RawClient = { $queryRawUnsafe: (q: string, ...v: unknown[]) => Promise<unknown> };

const ORG_LOCK_SQL = /FROM\s+"Organization"[\s\S]*FOR\s+UPDATE/i;

const bindTo = (target: object, value: unknown) =>
  typeof value === "function" ? (value as AnyFn).bind(target) : value;

export class TxBarrier {
  private readonly entries: Entry[] = [];

  /** Arm a one-shot pause for the next org-locked transaction opened by `userId`'s request. */
  arm(userId: string, point: BarrierPoint): Gate {
    let reach!: (pid: number) => void;
    const reached = new Promise<number>((r) => (reach = r));
    let resume!: (outcome: Error | null) => void;
    const go = new Promise<Error | null>((r) => (resume = r));
    const entry: Entry = { userId, point, claimed: false, reach, go, resume };
    this.entries.push(entry);
    return {
      reached,
      release: () => entry.resume(null),
      failWith: (error) => entry.resume(error),
      get claimed() {
        return entry.claimed;
      },
    };
  }

  /** Release every gate and forget them — call in `finally`/`afterEach`. */
  reset(): void {
    for (const e of this.entries.splice(0)) e.resume(null);
  }

  /**
   * Wrap an org-scoped client. `currentUserId` reads the request's ALS
   * (`OrgContextStore.get()?.userId`) at the moment `$transaction` is called.
   */
  wrap<T extends object>(base: T, currentUserId: () => string | undefined): T {
    return new Proxy(base, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop) as unknown;
        if (prop !== "$transaction" || typeof value !== "function") return bindTo(target, value);
        return async (fn: unknown, options?: unknown) => {
          // The array form carries no callback to pause inside — pass it through.
          if (typeof fn !== "function") return (value as AnyFn).call(target, fn, options);
          const entry = this.claim(currentUserId());
          if (entry?.point.at === "beforeTx") await this.pause(entry, 0);
          return (value as AnyFn).call(
            target,
            async (tx: object) => {
              const wrapped = entry ? this.wrapTx(tx, entry) : tx;
              const out = await (fn as (tx: object) => Promise<unknown>)(wrapped);
              if (entry?.point.at === "beforeCommit") await this.pause(entry, await pidOf(tx));
              return out;
            },
            options,
          );
        };
      },
    });
  }

  private claim(userId: string | undefined): Entry | undefined {
    if (!userId) return undefined;
    const entry = this.entries.find((e) => !e.claimed && e.userId === userId);
    if (entry) entry.claimed = true;
    return entry;
  }

  private async pause(entry: Entry, pid: number): Promise<void> {
    entry.reach(pid);
    const outcome = await entry.go;
    if (outcome) throw outcome;
  }

  private wrapTx(tx: object, entry: Entry): object {
    const point = entry.point;
    let fired = false;
    const once = () => {
      if (fired) return false;
      fired = true;
      return true;
    };
    return new Proxy(tx, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop) as unknown;
        if (point.at === "afterOrgLock" && prop === "$queryRawUnsafe") {
          return async (sql: string, ...values: unknown[]) => {
            const out = await (value as AnyFn).call(target, sql, ...values);
            if (ORG_LOCK_SQL.test(sql) && once()) await this.pause(entry, await pidOf(target));
            return out;
          };
        }
        if ((point.at === "beforeCall" || point.at === "afterCall") && prop === point.model) {
          const delegate = value as object;
          return new Proxy(delegate, {
            get: (dt, method) => {
              const fn = Reflect.get(dt, method) as unknown;
              if (method !== point.method || typeof fn !== "function") return bindTo(dt, fn);
              return async (...args: unknown[]) => {
                if (point.at === "beforeCall" && once()) {
                  await this.pause(entry, await pidOf(target));
                }
                const out = await (fn as AnyFn).call(dt, ...args);
                if (point.at === "afterCall" && once()) {
                  await this.pause(entry, await pidOf(target));
                }
                return out;
              };
            },
          });
        }
        return bindTo(target, value);
      },
    });
  }
}

async function pidOf(tx: object): Promise<number> {
  const rows = (await (tx as RawClient).$queryRawUnsafe(
    "SELECT pg_backend_pid() AS pid",
  )) as Array<{ pid: number }>;
  return Number(rows[0]!.pid);
}

/** The subset of a Prisma client `waitUntilBlockedBy` needs (any client on the same DB). */
export interface PgActivityReader {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

/**
 * Resolve once a backend whose CURRENT statement matches `statement` is blocked
 * on `holderPid` (`pg_blocking_pids`) — i.e. the competing request really is
 * WAITING on the paused one, not merely "probably started". Rejects after `ms`:
 * a race that never forms must fail, not pass by luck.
 *
 * `statement` is required, not optional: the int lane runs files in parallel on
 * one database, and a paused transaction that holds a Role row lock can make
 * ANOTHER suite's statement wait on it too. "Somebody is blocked on me" is
 * therefore not evidence that OUR second request is (seen in the full lane:
 * the gate was released before the invite had queued at all).
 */
export async function waitUntilBlockedBy(
  db: PgActivityReader,
  holderPid: number,
  statement: RegExp,
  what: string,
  ms = 2_500,
): Promise<Array<{ pid: number; query: string }>> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const rows = await db.$queryRawUnsafe<Array<{ pid: number; query: string }>>(
      `SELECT pid, query FROM pg_stat_activity
        WHERE datname = current_database() AND $1::int = ANY(pg_blocking_pids(pid))`,
      holderPid,
    );
    const ours = rows.filter((r) => statement.test(r.query));
    if (ours.length > 0) return ours;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`no ${statement} statement ever blocked on pid ${holderPid}: ${what}`);
}

/** Rejects if `p` has not settled within `ms` — a barrier that never fires must fail, not hang. */
export async function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms waiting for: ${what}`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
