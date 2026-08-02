import { Module } from "@nestjs/common";
import { CAPABILITY_EVENT_SINK_OVERRIDE } from "./common/authz";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { AuthModule } from "./auth/auth.module";
import { SecurityEventsService } from "./auth/security-events.service";

@Module({
  imports: [
    PrismaModule,
    // T-002-13 — the composition root is the only place allowed to join the
    // capability layer (common/) to the audit service (auth/): dependencies
    // point leaf-ward, so neither of those two may import the other. Here the
    // real sink replaces the log-only default, and `org.access.capability_denied`
    // starts reaching `collectSecurityEvents()` — @qa's collector and F-005's
    // future outbox — instead of only a log line.
    TenancyModule.withCapabilityEventSink({
      imports: [AuthModule],
      provider: { provide: CAPABILITY_EVENT_SINK_OVERRIDE, useExisting: SecurityEventsService },
    }),
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
