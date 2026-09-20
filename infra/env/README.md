# infra/env — per-environment values for the F-002 variables

Owner: `devops` · Task: **T-002-D2** · Spec:
[F-002 architecture §6.2/§6.4/§7.3](../../docs/features/F-002/architecture.md) ·
shape contract: [`.env.example`](../../.env.example)

Phase 0 has **no deployed environment** (root `CLAUDE.md`), so this file is the
seam: the values themselves are set wherever the environment lives, and what is
written down here is *which value each environment gets, who sets it, and what
breaks if it is wrong*. Nothing in this directory is a secret and nothing in it
should ever become one.

`.env.example` is the **shape**; this is the **matrix**. They are kept in step by
`packages/config/src/env-example.test.ts`, which fails when a required variable
exists in the schema and not in the file — the direction that produces a service
which will not boot in whichever environment somebody set up from the stale copy.

---

## The three F-002 variables

| var | local dev | CI (`integration-api`) | dogfood | prod (when it exists) |
|---|---|---|---|---|
| `DEFAULT_ORG_PLAN_KEY` | `comp_full` | `comp_full` | **`comp_full`** (§6.2 — dogfood runs the complimentary full tier) | the paid plan key, once one is seeded |
| `INVITATION_TOKEN_SECRET` | the placeholder in `.env.example` | a fixed non-secret CI value | **unique 256-bit random, per environment** | **unique 256-bit random, per environment** |
| `WEB_APP_BASE_URL` | `http://localhost:3001` | `http://localhost:3001` | the dogfood web origin, **https** | the public web origin, **https** |

### `DEFAULT_ORG_PLAN_KEY`

Looked up in `PlanDefinition`, which `packages/db/prisma/seed.ts` seeds. It has
**no fallback on purpose** (§6.2, AC US-1): an unset key, or one that is not
seeded in that database, must make `POST /organizations` fail closed with
`503 ORG_PROVISIONING_UNAVAILABLE` rather than hand somebody a free plan by
accident.

The failure mode to recognise: **every** shop creation answers 503 while every
other endpoint is healthy. That is this variable or a missing seed, not an
outage. CI runs `prisma db seed` for exactly this reason (T-002-D1c).

### `INVITATION_TOKEN_SECRET`

Keys `Invitation.tokenHash` — `HMAC-SHA-256(secret, token)` (§7.3).

- **Must differ from both JWT secrets.** Enforced by the schema at boot, so a
  reused secret is a refusal to start rather than a quiet coupling. The reason
  is key separation: with one value, a leak on either side compromises the other.
- **Must be unique per environment.** Sharing one between dogfood and prod means
  an invitation token minted in one is a valid credential in the other, for any
  organisation whose id happens to match.
- **Rotating it invalidates every pending invitation, silently.** Hashes are
  one-way: existing rows cannot be re-keyed, so every outstanding link starts
  answering `404 INVITATION_INVALID` and the invitee sees "this link does not
  work" with nothing to act on. Before rotating: cancel the pending invitations,
  then tell Owners/Admins to reissue. Treat it as a user-visible change, not a
  config edit.

### `WEB_APP_BASE_URL`

The API builds `${WEB_APP_BASE_URL}/invite?token=…` so web and mobile never
assemble it themselves (two bases drift). **https is required** outside
localhost — this origin carries the invitation token, which is the only secret
standing between an outsider and membership of a shop (§7.3/I-6).

A wrong value does not fail anything at boot: it produces invitation links that
resolve to the wrong host, and the invitee is the one who finds out. Check it
whenever the web origin changes.

---

## What is NOT here

- **Real secret values.** They belong in the environment's own secret store. This
  repo holds placeholders only, and `.env` is gitignored.
- **`TRUSTED_PROXY_IPS`.** Documented in `.env.example` and read by nothing today
  — see the note in `packages/config/src/env-example.test.ts`. Wire it or drop
  it; do not validate it into looking implemented.
- **Log scrubbing.** It is part of D2 but belongs to the edge layer and the
  application logger — [`../gateway/README.md`](../gateway/README.md).
