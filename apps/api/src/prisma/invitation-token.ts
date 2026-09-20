// F-002 · T-002-19 — invitation token minting/hashing, on the DB side of the
// boundary.
//
// WHY THE INDIRECTION EXISTS
// `generateInvitationToken` / `hashInvitationToken` live in `packages/db`,
// beside the `Invitation` model whose `tokenHash` column they exist to fill
// (D-018). `orgs/` is a FEATURE module, and the boundary gate
// (`api-db-client-allowlisted`) allows `@omnistock/db` imports only from
// `prisma/`, `tenancy/`, `health/` and `auth/`.
//
// The first attempt imported them straight into `orgs/invitations.service.ts`
// and the gate refused it. That refusal is right even though these two
// functions touch no client: a feature module that imports the DB package today
// is one `import { PrismaClient }` away from bypassing `ORG_PRISMA` tomorrow,
// and the whole tenant-isolation story rests on that not happening. The same
// argument produced `prisma/org-busy.ts`; this file is the same shape.
//
// It re-exports rather than re-implements. There is exactly ONE code path that
// turns an invitation token into a stored value (data-model §Security), and a
// second implementation here — however small — would be a second place for the
// keying to drift.
export { generateInvitationToken, hashInvitationToken } from "@omnistock/db";
