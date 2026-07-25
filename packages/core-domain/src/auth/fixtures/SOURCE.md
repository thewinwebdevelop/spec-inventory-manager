# Breached / common-password fixture — SOURCE & provenance

> F-001 · T-001-14 · owner @backend-api · consumed by T-001-01 password policy
> (arch §5.2, data-model §5). This file pins the fixture so the breached-password
> check is **deterministic, offline, and diff-able** (unit test U1.3 asserts the
> recorded version + a sample of listed entries).

## File

- **Path:** `common-passwords-top10k.txt`
- **Count:** exactly **10,000** unique, lowercase, one-per-line entries.
- **Encoding:** UTF-8, `\n`-terminated (final newline present).
- **Version / date:** `v1` · pinned **2026-07-06**.
- **SHA-256 (of the whole file, incl. trailing newline):**
  `88864c6d9b2cb4f3bdace56acaf467989def9f1a7edce6bcc2a211f164673de7`

## Origin

The canonical public origin for a "top-10k most-common passwords" list is
**SecLists** — `Passwords/Common-Credentials/10-million-password-list-top-10000.txt`
(Daniel Miessler et al., MIT License, <https://github.com/danielmiessler/SecLists>).

This repo does **not** vendor that file via a build-time network fetch — the
fixture must be **offline and committed** (no external call on the signup hot
path, arch §5.2). Instead the committed file is produced by a **deterministic,
seeded generator** (`packages/core-domain/scripts/gen-breached-fixture.mjs`) that:

1. hard-codes the **verbatim head** of the canonical list — the most-common
   passwords an attacker tries first (`123456`, `password`, `qwerty`,
   `letmein`, `admin`, `welcome`, …). These are the entries the policy MUST
   reject and the ones the unit test pins by name.
2. deterministically **expands to exactly 10,000** unique lowercase entries
   using a fixed seed (systematic word×suffix / leet / year / numeric passes,
   then a seeded xorshift tail) so the output is realistic "weak/common"
   coverage and **byte-for-byte reproducible**.

Re-running the generator MUST reproduce the identical file (same SHA-256).
`pnpm --filter @omnistock/core-domain verify:fixture` asserts this in CI.

## Regeneration / bump procedure

To bump the list (e.g. adopt a newer SecLists revision or the full vendored
copy in F-081):

1. edit `scripts/gen-breached-fixture.mjs` (or replace it with a vendoring step);
2. run `node scripts/gen-breached-fixture.mjs` — note the new SHA-256 it prints;
3. update **Version / date** + **SHA-256** above and the pinned constant in
   `common-passwords.ts` (`FIXTURE_VERSION`);
4. update the unit test's pinned-version assertion (U1.3);
5. commit the fixture + this file + the code together (one atomic change).

## Roadmap note

F-081 (self-serve reset, needs SMTP) is the fast-follow that swaps this in for
the **full** SecLists vendored copy **plus** a HaveIBeenPwned k-anonymity range
check. The F-001 contract — a pinned, offline top-10k set the policy rejects —
is stable and unaffected by that later hardening.
