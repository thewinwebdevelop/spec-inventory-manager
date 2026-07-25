# packages/contracts/openapi

`openapi.yaml` is the single hand-authored source of the OmniStock API
contract (T-000-07). It currently seeds `GET /health` only — enough to prove
the codegen pipeline end to end (F-000 AC11). Real endpoints are added
feature-by-feature as additive changes (see the `contract-evolution` skill);
`apps/api` is the only implementer, `apps/web`/`apps/mobile` are consumers via
the generated clients in `packages/contracts/src/generated/`.

Validate: `pnpm --filter @omnistock/contracts validate` (runs `redocly lint`).
Regenerate clients: `pnpm turbo gen:contracts` (see `packages/contracts/package.json`).
