// F-001 · T-001-04..08 — auth module wiring. Registers the 8 endpoints and the
// services (hashing, access-token/JWT, refresh, throttle, security events).
//
// JwtModule is configured from JWT_ACCESS_SECRET (HS256). RefreshTokenService +
// ThrottleService need runtime values (JWT_REFRESH_SECRET, Redis) so they are
// wired via factory providers reading the validated env / the shared Redis
// connection (F-000 redis.provider).
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { Redis } from "ioredis";
import { loadEnv } from "@omnistock/config";
import { PrismaModule } from "../prisma/prisma.module";
import { createRedisConnection } from "../health/redis.provider";
import { HashingService } from "./hashing.service";
import { AccessTokenService } from "./access-token.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RefreshTokenService } from "./refresh-token.service";
import { ThrottleService } from "./throttle.service";
import { SecurityEventsService } from "./security-events.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MembersController } from "./members.controller";
import { PrismaService } from "../prisma/prisma.service";

/** DI token for the auth Redis connection (throttle state). */
export const AUTH_REDIS = Symbol("AUTH_REDIS");

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv(process.env);
        return {
          secret: env.JWT_ACCESS_SECRET,
          // We set iat/exp ourselves via buildAccessClaims + noTimestamp; do not
          // configure a signOptions.expiresIn (would fight our explicit exp).
          signOptions: { algorithm: "HS256" },
        };
      },
    }),
  ],
  controllers: [AuthController, MembersController],
  providers: [
    HashingService,
    AccessTokenService,
    JwtAuthGuard,
    SecurityEventsService,
    {
      provide: AUTH_REDIS,
      useFactory: () => {
        const env = loadEnv(process.env);
        return createRedisConnection(env);
      },
    },
    {
      provide: RefreshTokenService,
      useFactory: (prisma: PrismaService, events: SecurityEventsService) => {
        const env = loadEnv(process.env);
        return new RefreshTokenService(prisma, events, env.JWT_REFRESH_SECRET);
      },
      inject: [PrismaService, SecurityEventsService],
    },
    {
      provide: ThrottleService,
      useFactory: (redis: Redis, events: SecurityEventsService) =>
        new ThrottleService(redis, events),
      inject: [AUTH_REDIS, SecurityEventsService],
    },
    AuthService,
  ],
  exports: [JwtAuthGuard, AccessTokenService],
})
export class AuthModule {}
