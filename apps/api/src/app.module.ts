import { Module, type DynamicModule } from "@nestjs/common";
import type { Env } from "@omnistock/config";
import { BOOT_ENV, BootEnvModule } from "./common/boot-env";
import { CAPABILITY_EVENT_SINK_OVERRIDE } from "./common/authz";
import {
  ORG_RATE_LIMIT_REDIS,
  ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE,
} from "./common/org-rate-limit.tokens";
import { HealthModule } from "./health/health.module";
import { createRedisConnection } from "./health/redis.provider";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { AuthModule } from "./auth/auth.module";
import { SecurityEventsService } from "./auth/security-events.service";
import { OrgsModule } from "./orgs";

/**
 * The composition root. `forRoot(env)` takes the env snapshot `main.ts`
 * validated (T-003-B23 · DV01): providers read `BOOT_ENV`, never `process.env`
 * again, so the flags the process booted with are the flags it serves with.
 */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // FIRST, global: every provider below that needs env reads this snapshot.
        BootEnvModule.forRoot(env),

        PrismaModule,
        // T-002-13 / T-002-14 — the composition root is the only place allowed to
        // join the shared infra layers (common/, tenancy/) to the audit service
        // (auth/): dependencies point leaf-ward, so neither side may import the
        // other. Everything those layers cannot reach for themselves is bound here.
        //
        //  · the capability guard's sink — without it `org.access.capability_denied`
        //    reaches a log line and nothing else, so `collectSecurityEvents()`
        //    (@qa's collector, F-005's future outbox) never sees a denial;
        //  · the rate-limit guard's Redis connection and its fail-open sink.
        TenancyModule.withCompositionRootBindings({
          imports: [AuthModule],
          providers: [
            { provide: CAPABILITY_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
            { provide: ORG_RATE_LIMIT_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
            {
              provide: ORG_RATE_LIMIT_REDIS,
              useFactory: (env: Env) => createRedisConnection(env),
              inject: [BOOT_ENV],
            },
          ],
        }),
        HealthModule,
        AuthModule,
        // F-002 · T-002-15/16 — organization creation + profile. Registered after
        // TenancyModule so the global middleware/guard chain is in place before any
        // org route can be served.
        OrgsModule,
      ],
    };
  }
}
