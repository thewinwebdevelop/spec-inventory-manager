import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenancyModule } from "./tenancy/tenancy.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [PrismaModule, TenancyModule, HealthModule, AuthModule],
})
export class AppModule {}
