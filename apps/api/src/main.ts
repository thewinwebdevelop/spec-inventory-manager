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

async function bootstrap(): Promise<void> {
  // Deferred imports: NestFactory/AppModule are only loaded after env
  // validation succeeds, so a missing var never surfaces as a framework
  // stack trace (infra.md §8.2).
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("./app.module");
  const { ValidationPipe, UnprocessableEntityException } = await import("@nestjs/common");
  const { DomainExceptionFilter } = await import("./common/domain-exception.filter");
  const cookieParser = (await import("cookie-parser")).default;

  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
  });

  // Real client IP for throttle. `trust proxy` is the HOP COUNT from env
  // (default 0 = trust no X-Forwarded-For hop → req.ip is the socket peer).
  // Setting `true` would let ANY client spoof X-Forwarded-For and forge req.ip,
  // bypassing the IP throttle entirely (F-001 security review, Critical). Prod
  // behind one reverse proxy sets TRUST_PROXY_HOPS=1; @devops owns the value.
  const expressApp = app.getHttpAdapter().getInstance() as { set: (k: string, v: unknown) => void };
  expressApp.set("trust proxy", Number(env.TRUST_PROXY_HOPS));

  // CORS for the credentialed cross-origin path (api-spec §0 Dev-CORS). Origin
  // is an EXPLICIT allow-list from CORS_ALLOWED_ORIGINS — NEVER `*`/`true` with
  // credentials, which would break the login-CSRF "preflight the API won't
  // allow" property. Empty list = no cross-origin request allowed (the normal
  // same-origin dev-proxy path, apps/web rewrites).
  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  });

  // Parse cookies so the cookie-transport refresh token + CSRF cookie are
  // available on req.cookies (api-spec §0).
  app.use(cookieParser());

  // Global validation: whitelist strips unknown props, transform hydrates DTO
  // classes. A validation failure → 422 (not the default 400) carrying the
  // first constraint message as the error code (e.g. EMAIL_INVALID) so the
  // contract's { error: { code, message } } envelope holds (api-spec §3).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) => {
        const first = errors[0];
        const code = first?.constraints
          ? Object.values(first.constraints)[0]
          : "VALIDATION_FAILED";
        return new UnprocessableEntityException({
          error: { code, message: "ข้อมูลไม่ถูกต้อง" },
        });
      },
    }),
  );

  // R1 (backend.md §3.5) — the single wire-envelope authority. Converts typed
  // DomainExceptions (+ any other thrown error) into
  // `{ error: { code, message, details?, fieldErrors?, traceId? } }`. Registered
  // AFTER the pipe so a 422 from ValidationPipe also flows through it. Unknown
  // errors → 500 INTERNAL with nothing leaked.
  app.useGlobalFilters(new DomainExceptionFilter());

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
