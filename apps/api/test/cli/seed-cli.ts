// F-002 · T-002-22 — the seed CLI's logic (architecture §12.2 item 2).
//
// Playwright and Flutter cannot import a vitest kit, so E2E needs a process it
// can spawn. This file is that process's BRAIN, kept separate from its entry
// point (`f002-seed.ts`) for one reason: the entry point must run on import,
// and something that runs on import cannot be unit tested. So the entry is three
// lines and everything with a decision in it lives here.
//
// Contract with E2E: one JSON object on stdout, nothing else. Diagnostics go to
// stderr, so `spawn(...).stdout` is always parseable.
import { createSeedKit, F002_SCENARIOS, type F002Scenario, type SeedPrismaClient } from "../f002-seed.kit";

export interface SeedCliArgs {
  readonly scenario: F002Scenario;
  /** Keep the seeded rows (the default — E2E needs them after the process exits). */
  readonly keep: boolean;
}

export class SeedCliUsageError extends Error {
  constructor(message: string) {
    super(`${message}\n\nusage: tsx apps/api/test/cli/f002-seed.ts --scenario=<${F002_SCENARIOS.join("|")}> [--cleanup]`);
    this.name = "SeedCliUsageError";
  }
}

/** Parse `--scenario=x` / `--scenario x` / `--cleanup`. Throws on anything else. */
export function parseSeedArgs(argv: readonly string[]): SeedCliArgs {
  let scenario: string | undefined;
  let keep = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cleanup") {
      keep = false;
      continue;
    }
    if (arg.startsWith("--scenario=")) {
      scenario = arg.slice("--scenario=".length);
      continue;
    }
    if (arg === "--scenario") {
      scenario = argv[++i];
      continue;
    }
    throw new SeedCliUsageError(`unknown argument: ${arg}`);
  }

  if (scenario === undefined || scenario === "") throw new SeedCliUsageError("--scenario is required");
  if (!(F002_SCENARIOS as readonly string[]).includes(scenario)) {
    throw new SeedCliUsageError(`unknown scenario: ${scenario}`);
  }
  return { scenario: scenario as F002Scenario, keep };
}

/**
 * Refuse to run outside a test environment.
 *
 * The kit lives outside `src/` so it can never reach `dist/`, but a developer
 * with a production `DATABASE_URL` in their shell is a different failure mode
 * that no build boundary catches. `NODE_ENV=production` ⇒ hard stop
 * (architecture §12.2 item 2 จ).
 */
export function assertSeedingAllowed(env: Readonly<Record<string, string | undefined>>): void {
  if (env.NODE_ENV === "production") {
    throw new Error("refusing to seed: NODE_ENV=production (F-002 architecture §12.2 item 2 จ)");
  }
  if (!env.TEST_DATABASE_URL && !env.DATABASE_URL) {
    throw new Error("refusing to seed: neither TEST_DATABASE_URL nor DATABASE_URL is set");
  }
}

export interface SeedCliDeps {
  readonly prisma: SeedPrismaClient;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/** Run the CLI. Returns the process exit code; never calls `process.exit`. */
export async function runSeedCli(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  deps: SeedCliDeps,
): Promise<number> {
  let args: SeedCliArgs;
  try {
    assertSeedingAllowed(env);
    args = parseSeedArgs(argv);
  } catch (err) {
    deps.stderr(err instanceof Error ? err.message : String(err));
    return 2;
  }

  const kit = createSeedKit(deps.prisma, { label: `cli-${args.scenario}` });
  try {
    const result = await kit.scenario(args.scenario);
    if (!args.keep) await kit.cleanup();
    deps.stdout(JSON.stringify(result));
    return 0;
  } catch (err) {
    deps.stderr(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    // Best effort: a half-seeded scenario in a shared database is worse than
    // none. Failing to clean up must not mask the original error.
    try {
      await kit.cleanup();
    } catch (cleanupErr) {
      deps.stderr(`cleanup after failure also failed: ${String(cleanupErr)}`);
    }
    return 1;
  }
}
