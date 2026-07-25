// F-000 · T-000-08 — HealthModule. Spec: infra.md §9.
// Boots the minimal BullMQ Queue + shared ioredis connection so /health can
// prove Redis/BullMQ connectivity end to end (AC15), and wires PrismaService
// (already provided globally by PrismaModule) into the db check (AC3).
import { Inject, Module, type OnModuleDestroy, type Provider } from "@nestjs/common";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { loadEnv } from "@omnistock/config";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { createHealthQueue, HEALTH_QUEUE_PROVIDER } from "./health-queue.provider";
import { createRedisConnection, REDIS_CONNECTION } from "./redis.provider";

const redisProvider: Provider = {
  provide: REDIS_CONNECTION,
  useFactory: () => createRedisConnection(loadEnv(process.env)),
};

const queueProvider: Provider = {
  provide: HEALTH_QUEUE_PROVIDER,
  useFactory: (redis: Redis) => createHealthQueue(redis),
  inject: [REDIS_CONNECTION],
};

@Module({
  controllers: [HealthController],
  providers: [HealthService, redisProvider, queueProvider],
})
export class HealthModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly redis: Redis,
    @Inject(HEALTH_QUEUE_PROVIDER) private readonly queue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.redis.disconnect();
  }
}
