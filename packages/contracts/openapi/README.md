# packages/contracts/openapi

The OmniStock API contract. It is the seam between `apps/api` (the only
implementer) and `apps/web` / `apps/mobile` (consumers, via the generated
clients in `packages/contracts/src/generated/` and `apps/mobile/api_client/`).

## Layout (split in T-002-21)

| file | role |
|---|---|
| `root.yaml` | **hand-authored entrypoint** — `info`, `servers`, `tags`, `securitySchemes`, and one `$ref` per path. Edit this. |
| `paths/*.yaml` | one OpenAPI Path Item per file (all verbs of that path). |
| `components/*.yaml` | `common.yaml` (health, `OkResponse`, the ONE `ErrorResponse` envelope) · `parameters.yaml` · `headers.yaml` · `auth.yaml` (F-001) · `orgs.yaml` (F-002). |
| `openapi.yaml` | **generated bundle — do not hand-edit.** Overwritten by `pnpm --filter @omnistock/contracts bundle`. |

It stayed a single file until F-002 (F-000 + F-001 = 723 lines); F-002 alone
adds 16 operations and ~30 schemas, which is what api-spec §5 said would happen.

`redocly bundle` hoists every external `$ref` into
`#/components/<kind>/<last pointer segment>` — so a key in `components/orgs.yaml`
IS the name of the generated TS/Dart type. Renaming one is a contract change.

## Why `openapi.yaml` is still the file everything reads

`redocly lint`, `openapi-typescript`, the Dart generator, `oasdiff` and the
router↔spec parity gate all consume the bundle. Keeping the bundled artifact at
the path it has always had is what let the split happen without touching a
single CI job.

## Commands

```bash
pnpm --filter @omnistock/contracts bundle     # root.yaml + paths/ + components/ → openapi.yaml
pnpm --filter @omnistock/contracts validate   # bundle, then redocly lint
pnpm turbo gen:contracts                      # bundle, then regenerate the TS + Dart clients
```

`gen:contracts` and `validate` both re-bundle first, so a source file edited
without re-bundling shows up as an uncommitted diff (the `contracts-drift` CI
job fails on exactly that).

## The gates behind this contract

- **`contracts-drift`** — regenerates the clients and fails on an uncommitted
  diff. Answers "is the generated client in step with the spec?"
- **`oasdiff`** — spec vs its merge-base. Answers "did we break a shipped
  surface?"
- **router ↔ spec parity** (`apps/api/test/openapi-parity.int.test.ts`,
  T-002-21) — walks the live Nest router of `AppModule` and asserts BOTH
  directions: every route the server answers is published here, and every
  operation published here is served. Answers "does the spec describe the actual
  server?", which nothing asked before F-002 — and the answer was *no*: 14 live
  endpoints, 0 of them in this file, every gate green.

Adding an endpoint means adding it here in the same change. There is no wave in
which the two are allowed to disagree.
