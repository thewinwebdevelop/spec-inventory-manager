// F-002 · T-002-22 — the conditional module that carries the test fixtures
// (architecture §12.2 item 9).
//
// `register()` REFUSES to build unless BOTH `NODE_ENV==='test'` and
// `ENABLE_TEST_FIXTURES==='1'`. Two independent conditions, because one of them
// is always the one that is accidentally set: `NODE_ENV=test` happens in CI
// jobs that have nothing to do with these fixtures, and `ENABLE_TEST_FIXTURES=1`
// is the kind of variable that gets copied into a `.env` and forgotten.
//
// It throws instead of returning an empty module. A silently-empty module would
// mean a mis-configured suite gets 404s and somebody "fixes" it by loosening the
// condition; a throw names the reason at the exact line.
import { Module, type DynamicModule } from "@nestjs/common";
import { BoomController } from "./boom.controller";
import { ProbeController } from "./probe.controller";

export class TestFixturesDisabledError extends Error {
  constructor(reason: string) {
    super(
      `test fixtures refused to register: ${reason}. They expose a route that throws on ` +
        `purpose and a route that reads tenant data — both are only ever acceptable inside ` +
        `a test process (F-002 architecture §12.2 item 9).`,
    );
    this.name = "TestFixturesDisabledError";
  }
}

@Module({})
export class TestFixturesModule {
  static register(
    env: Readonly<Record<string, string | undefined>> = process.env,
  ): DynamicModule {
    if (env.NODE_ENV !== "test") {
      throw new TestFixturesDisabledError(`NODE_ENV is ${JSON.stringify(env.NODE_ENV)}, not "test"`);
    }
    if (env.ENABLE_TEST_FIXTURES !== "1") {
      throw new TestFixturesDisabledError("ENABLE_TEST_FIXTURES is not \"1\"");
    }
    return { module: TestFixturesModule, controllers: [BoomController, ProbeController] };
  }
}
