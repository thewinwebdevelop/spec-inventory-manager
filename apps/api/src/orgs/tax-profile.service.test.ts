// F-002 · T-002-17 ★ — the tax-profile service's orchestration
// (api-spec §3.5/§3.16).
//
// The all-or-nothing rule and the reveal shape are proven exhaustively in
// `packages/core-domain/src/orgs/tax-profile.test.ts` and are NOT re-proven
// here (a second copy of a rule is a second place for it to drift). What is
// proven here is everything the pure fns cannot see:
//   * which client and which org id the write is addressed to;
//   * that ALL FOUR columns are written on every `PUT` (a `PUT` that only wrote
//     the keys it was sent would leave a stale branch code on a new TIN);
//   * that the events are emitted post-commit, once, WITHOUT the number;
//   * that a refused reveal emits nothing at all.
import { describe, it, expect, vi } from "vitest";
import { DomainException } from "../common/domain-exception";
import {
  SecurityEventsService,
  collectSecurityEvents,
  type SecurityEventCollector,
} from "../auth/security-events.service";
import { TaxProfileService } from "./tax-profile.service";
import type { OrgProfileService } from "./org-profile.service";

const ORG_ID = "org_ctx";
const USER_ID = "usr_me";
const TIN = "1101700207366";

const DECLARED = { taxEntityType: "company", taxId: TIN };

function createService(
  over: {
    readonly organization?: unknown;
    readonly organizationId?: string | undefined;
    readonly userId?: string | undefined;
  } = {},
) {
  const prisma = {
    organization: {
      // The mocks declare their argument so `mock.calls[0][0]` is typed. With a
      // zero-arg `vi.fn` the calls tuple is `[]` and every assertion about WHAT
      // was passed becomes a compile error — which is the assertion that
      // matters here (the org id the write is addressed to, and the two-column
      // select that keeps a TIN out of wider reads).
      findUnique: vi.fn(async (_args: unknown) =>
        "organization" in over ? over.organization : DECLARED,
      ),
      update: vi.fn(async (_args: unknown) => ({ id: ORG_ID })),
    },
  };
  const profileView = { id: ORG_ID, taxProfile: { taxIdMasked: "•••••••••7366" } };
  const profile = { get: vi.fn(async () => profileView) } as unknown as OrgProfileService;
  const events = new SecurityEventsService();
  const sink: SecurityEventCollector = collectSecurityEvents(events);
  const store = {
    get: () => ({
      organizationId: "organizationId" in over ? over.organizationId : ORG_ID,
      userId: "userId" in over ? over.userId : USER_ID,
    }),
  };
  return {
    service: new TaxProfileService(prisma as never, store as never, profile, events),
    prisma,
    profile,
    sink,
    profileView,
  };
}

const COMPLETE_WRITE = {
  taxEntityType: "company",
  taxId: TIN,
  vatRegistered: true,
  taxBranchCode: "00000",
} as const;

const CLEARED_WRITE = {
  taxEntityType: null,
  taxId: null,
  vatRegistered: null,
  taxBranchCode: null,
} as const;

// ── PUT (api-spec §3.5) ─────────────────────────────────────────────────────

describe("TaxProfileService.set", () => {
  it("★ writes all four columns, addressed by the CONTEXT org id", async () => {
    const { service, prisma } = createService();
    await service.set(COMPLETE_WRITE);
    expect(prisma.organization.update.mock.calls[0][0]).toEqual({
      where: { id: ORG_ID },
      data: {
        taxEntityType: "company",
        taxId: TIN,
        vatRegistered: true,
        taxBranchCode: "00000",
      },
      select: { id: true },
    });
  });

  it("★ clearing writes four NULLs — not an empty `data` that leaves the old TIN", async () => {
    const { service, prisma } = createService();
    await service.set(CLEARED_WRITE);
    expect(prisma.organization.update.mock.calls[0][0]).toMatchObject({ data: CLEARED_WRITE });
  });

  it("answers with the §3.3 profile body — never echoing the number back", async () => {
    const { service, profile, profileView } = createService();
    const body = await service.set(COMPLETE_WRITE);
    expect(profile.get).toHaveBeenCalledTimes(1);
    expect(body).toBe(profileView);
    expect(JSON.stringify(body)).not.toContain(TIN);
  });

  it("★ emits org.tax_profile.set ONCE with `taxIdPresent`, and NO tax id", async () => {
    const { service, sink } = createService();
    await service.set(COMPLETE_WRITE);
    const emitted = sink.ofType("org.tax_profile.set");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({
      actorUserId: USER_ID,
      organizationId: ORG_ID,
      taxEntityType: "company",
      vatRegistered: true,
      taxIdPresent: true,
    });
    // The whole event, serialized, must not contain the number in ANY form —
    // not the value, not a prefix, not a mask (M-7ค / architecture §9).
    expect(JSON.stringify(emitted[0])).not.toContain(TIN);
    expect(JSON.stringify(emitted[0])).not.toContain(TIN.slice(-4));
    sink.stop();
  });

  it("`taxIdPresent: false` when the profile was cleared", async () => {
    const { service, sink } = createService();
    await service.set(CLEARED_WRITE);
    expect(sink.ofType("org.tax_profile.set")[0].payload).toMatchObject({
      taxEntityType: null,
      vatRegistered: null,
      taxIdPresent: false,
    });
    sink.stop();
  });

  it("★ POST-COMMIT: a failed write emits nothing (H-3)", async () => {
    const { service, prisma, sink } = createService();
    prisma.organization.update.mockRejectedValueOnce(new Error("deadlock detected") as never);
    await expect(service.set(COMPLETE_WRITE)).rejects.toThrow();
    expect(sink.events).toEqual([]);
    sink.stop();
  });

  it("500s when the org context is missing — never falls back to a path param", async () => {
    const { service: broken } = createService({ organizationId: undefined });
    const error = (await broken.set(COMPLETE_WRITE).catch((e: unknown) => e)) as DomainException;
    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(500);
  });
});

// ── POST reveal (api-spec §3.16) ────────────────────────────────────────────

describe("TaxProfileService.reveal", () => {
  const NOW = new Date("2026-07-28T09:00:00.000Z");

  it("returns the full TIN + when it was handed over", async () => {
    const { service } = createService();
    await expect(service.reveal(NOW)).resolves.toEqual({
      taxId: TIN,
      entityType: "company",
      revealedAt: "2026-07-28T09:00:00.000Z",
    });
  });

  it("★ selects TWO columns only — a widened select is how a TIN reaches a log", async () => {
    const { service, prisma } = createService();
    await service.reveal(NOW);
    expect(prisma.organization.findUnique.mock.calls[0][0]).toEqual({
      where: { id: ORG_ID },
      select: { taxEntityType: true, taxId: true },
    });
  });

  it("★ emits org.tax_profile.revealed with actor + org and NOTHING else", async () => {
    const { service, sink } = createService();
    await service.reveal(NOW);
    const emitted = sink.ofType("org.tax_profile.revealed");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload).toEqual({ actorUserId: USER_ID, organizationId: ORG_ID });
    // ⛔ "Who looked, and when" — never "at what". Not the value, not four
    // digits of it, not a mask (D-030).
    expect(JSON.stringify(emitted[0])).not.toContain(TIN);
    expect(JSON.stringify(emitted[0])).not.toContain(TIN.slice(-4));
    sink.stop();
  });

  it("★ 404 when nothing is declared — and NO event (nothing was revealed)", async () => {
    const { service, sink } = createService({
      organization: { taxEntityType: null, taxId: null },
    });
    const error = (await service.reveal(NOW).catch((e: unknown) => e)) as DomainException;
    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    // An audit line saying "revealed" for a request that returned no number
    // makes the real ones harder to read.
    expect(sink.events).toEqual([]);
    sink.stop();
  });

  it("500 (not a silent reveal) when the org row vanished", async () => {
    const { service, sink } = createService({ organization: null });
    const error = (await service.reveal(NOW).catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(500);
    expect(sink.events).toEqual([]);
    sink.stop();
  });

  it("★ an unattributable reveal is refused — the event must name an actor", async () => {
    const { service, sink } = createService({ userId: undefined });
    const error = (await service.reveal(NOW).catch((e: unknown) => e)) as DomainException;
    expect(error.getStatus()).toBe(500);
    expect(sink.events).toEqual([]);
    sink.stop();
  });

  it("takes `now` from the caller — the edge owns the clock", async () => {
    const { service } = createService();
    const other = new Date("2027-03-04T05:06:07.000Z");
    await expect(service.reveal(other)).resolves.toMatchObject({
      revealedAt: "2027-03-04T05:06:07.000Z",
    });
  });
});
