// F-002 · T-002-15 ★ — plan provisioning fails CLOSED (architecture §6.2).
//
// The single most dangerous line that could be written in this service is a
// fallback. Every test below exists to make that line impossible to add
// silently.
import { describe, it, expect, vi } from "vitest";
import { DomainException } from "../../common/domain-exception";
import { PlanProvisioningService } from "./plan-provisioning.service";

const COMP_FULL = { id: "pd_1", key: "comp_full", tierLabel: "Full (comp)" };

function createService(options: {
  readonly rows?: Record<string, { id: string; key: string; tierLabel: string | null }>;
  readonly planKey?: string;
}) {
  const rows = options.rows ?? {};
  const findUnique = vi.fn(async (args: { where: { key: string } }) => rows[args.where.key] ?? null);
  const prisma = { planDefinition: { findUnique } };
  const service = new PlanProvisioningService(prisma as never, options.planKey ?? "comp_full");
  return { service, findUnique };
}

describe("PlanProvisioningService.resolveForNewOrg", () => {
  it("resolves the plan named by DEFAULT_ORG_PLAN_KEY", async () => {
    const { service, findUnique } = createService({ rows: { comp_full: COMP_FULL } });
    await expect(service.resolveForNewOrg({ userId: "usr_1" })).resolves.toEqual({
      planDefinitionId: "pd_1",
      planKey: "comp_full",
      tierLabel: "Full (comp)",
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0][0]).toMatchObject({ where: { key: "comp_full" } });
  });

  it("★ 503 ORG_PROVISIONING_UNAVAILABLE when the key has no PlanDefinition", async () => {
    const { service } = createService({ rows: {} });
    const error = (await service
      .resolveForNewOrg({ userId: "usr_1" })
      .catch((e: unknown) => e)) as DomainException;
    expect(error).toBeInstanceOf(DomainException);
    expect(error.getStatus()).toBe(503);
    expect(error.code).toBe("ORG_PROVISIONING_UNAVAILABLE");
  });

  it("★ NEVER falls back to another plan — not even to `free`", async () => {
    // The whole database has plans; the CONFIGURED one is missing. A fallback
    // here would silently grant a tier nobody authorised, which is the exact
    // failure AC US-1 forbids (architecture §6.2).
    const { service } = createService({
      rows: {
        free: { id: "pd_free", key: "free", tierLabel: "Free" },
        full: { id: "pd_full", key: "full", tierLabel: "Full" },
      },
      planKey: "comp_full",
    });
    await expect(service.resolveForNewOrg({ userId: "usr_1" })).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  it("★ looks the key up EXACTLY — no prefix/fuzzy match", async () => {
    const { service } = createService({
      rows: { comp_full_v2: { id: "x", key: "comp_full_v2", tierLabel: null } },
      planKey: "comp_full",
    });
    await expect(service.resolveForNewOrg({ userId: "usr_1" })).rejects.toBeInstanceOf(
      DomainException,
    );
  });

  it("passes a null tierLabel through rather than inventing one", async () => {
    const { service } = createService({
      rows: { comp_full: { id: "pd_1", key: "comp_full", tierLabel: null } },
    });
    await expect(service.resolveForNewOrg({ userId: "usr_1" })).resolves.toMatchObject({
      tierLabel: null,
    });
  });

  it("the wire message says nothing about our configuration", async () => {
    const { service } = createService({ rows: {}, planKey: "secret_internal_key" });
    const error = (await service
      .resolveForNewOrg({ userId: "usr_1" })
      .catch((e: unknown) => e)) as DomainException;
    expect(JSON.stringify(error.getResponse())).not.toContain("secret_internal_key");
  });
});
