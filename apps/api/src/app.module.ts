import { Module } from "@nestjs/common";
import { loadEnv } from "@omnistock/config";
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

@Module({
  imports: [
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
          useFactory: () => createRedisConnection(loadEnv(process.env)),
        },
      ],
    }),
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
