import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * `@Global` — every feature module needs DB access; re-importing PrismaModule
 * everywhere would be pure boilerplate (standard Nest+Prisma pattern).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
