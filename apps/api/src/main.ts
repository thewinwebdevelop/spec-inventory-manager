// F-000 · T-000-08 — apps/api bootstrap.
// Spec: docs/features/F-000/infra.md §8.2 — env is validated BEFORE
// `NestFactory.create`, printing offending var names to stderr and exiting
// non-zero on failure (AC14). This is the exact seam T-000-02 built
// (`@omnistock/config`'s `loadEnv`) — main.ts does not reimplement it.
import "reflect-metadata";
import { loadEnv } from "@omnistock/config";

// Validate env as the very first thing, before importing anything that
// might read process.env as a side effect of module init (e.g. AppModule's
// providers constructing a Redis connection).
const env = loadEnv(process.env);

/* eslint-disable @typescript-eslint/no-var-requires */
async function bootstrap(): Promise<void> {
  // Deferred imports: NestFactory/AppModule are only loaded after env
  // validation succeeds, so a missing var never surfaces as a framework
  // stack trace (infra.md §8.2).
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("./app.module");

  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.enableShutdownHooks();

  const port = Number(env.PORT);
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`api listening on :${port} (NODE_ENV=${env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("api failed to boot:", err);
  process.exit(1);
});
