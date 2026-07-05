// F-000 · T-000-08 — Prisma wiring for apps/api.
// Authoritative spec: docs/features/F-000/architecture.md §1.2 ("apps/api (NestJS)
// wraps PrismaClient in an injectable PrismaService (onModuleInit → $connect,
// enableShutdownHooks). All DB access in the API goes through DI, never
// `new PrismaClient()` scattered around.").
//
// Golden rule 2 (ledger immutability, Layer 1): this service applies
// `ledgerGuardExtension` (packages/db/src/ledger-guard.ts, T-000-05) so every
// consumer of `PrismaService.client` gets the guarded client — nobody can reach
// an unguarded `PrismaClient` instance through this seam.
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient, ledgerGuardExtension } from "@omnistock/db";

function createGuardedClient() {
  return new PrismaClient().$extends(ledgerGuardExtension);
}

/**
 * The concrete type of a ledger-guard-extended Prisma client. Exported so
 * other providers (e.g. the `withOrgScope` seam, §5 architecture.md) can type
 * against "a ledger-guarded Prisma client" without re-deriving it.
 */
export type GuardedPrismaClient = ReturnType<typeof createGuardedClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * The single Prisma client instance for the process, wrapped with the
   * Layer-1 ledger guard (T-000-05). All domain repositories should obtain
   * their client via this service (or, once F-002/F-003 land, via
   * `withOrgScope(prismaService.client, ctx)` — see src/tenancy).
   */
  public readonly client: GuardedPrismaClient = createGuardedClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log("Prisma client connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    this.logger.log("Prisma client disconnected");
  }

  /**
   * Lightweight liveness probe used by HealthService (AC3/AC15) — a plain
   * `SELECT 1` through the guarded client. Read-only, so the ledger guard
   * (which only blocks mutation ops) never interferes.
   */
  async ping(): Promise<boolean> {
    await this.client.$queryRaw`SELECT 1`;
    return true;
  }
}
