// F-003 · T-003-B22 ★ — viewer verdicts + new fields on routes F-002 shipped
// (api-spec §3.1, §4.1–§4.2b · architecture §1.2), over HTTP on the real app
// with Postgres + Redis and the f003-personas seed (test-plan §0/§7).
//
//   I3-22  AC-6.4 who-sees-what: `GET /roles` never carries `capabilities`;
//          `viewerCanAssign` only for `manage_members` holders; MemberRow
//          verdicts ABSENT for MM (no `manage_roles`), present for ADM_A;
//          `Invitation.viewerCanManage` for `manage_members` holders on stored
//          `pending` only. The normalised responses are recorded as the golden
//          fixture for the clients (G3-14 compares against it).
//   I3-23  verdict ⇔ write: every `false` in the seed → the real write refuses
//          with the matching code; every `true` → the write succeeds. Rows whose
//          WRITE rule lands in a parallel task are held in `AWAITING_WRITE_RULE`
//          and pinned to today's F-002 answer — the entry turns red the day the
//          rule lands, so it cannot be forgotten (no silent skip).
//   I3-54  AC-1.5 on the wire: after renaming Staff, `roleNameCustomized` agrees
//          on all six schemas + `RoleRow.nameCustomized`; a control read first.
//   ?roleId on `/members` and `/invitations` (api-spec §4.2b).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Redis } from "ioredis";
import { PrismaClient } from "@omnistock/db";
import { AccessTokenService } from "../src/auth/access-token.service";
import { THROTTLE_ACCT_PREFIX } from "../src/auth/auth.constants";
import { INT_LANE_ENABLED, createTestApp, type TestApp } from "./app.kit";
import {
  PERSONA_KEYS,
  createF003SeedKit,
  type F003PersonasResult,
  type F003SeedKit,
  type PersonaKey,
  type PersonaShop,
} from "./f003-seed.kit";

const d = INT_LANE_ENABLED ? describe : describe.skip;
if (!INT_LANE_ENABLED) {
  console.warn(
    "[T-003-B22] SKIPPING the viewer-verdict suite: TEST_DATABASE_URL / TEST_REDIS_URL are not " +
      "set. Who-sees-what (AC-6.4), verdict ⇔ write and roleNameCustomized are NOT verified.",
  );
}

/**
 * Verdict ⇔ write rows whose write rule is built by a PARALLEL task. Until it
 * merges, the write still answers the F-002 way and this suite pins that. When
 * the write starts refusing, the assertion below goes red: delete the entry.
 */
const AWAITING_WRITE_RULE: Readonly<Record<string, string>> = Object.freeze({
  // remove when T-003-B17 merges
  "PATCH member · target axis (equal/exceeds → TARGET_NOT_BELOW_ACTOR)": "T-003-B17",
  // remove when T-003-B17 merges
  "DELETE member · target axis (equal/exceeds → TARGET_NOT_BELOW_ACTOR)": "T-003-B17",
});
const MEMBER_TARGET = "PATCH member · target axis (equal/exceeds → TARGET_NOT_BELOW_ACTOR)";
const MEMBER_REMOVE = "DELETE member · target axis (equal/exceeds → TARGET_NOT_BELOW_ACTOR)";

const NEW_PW = "b22-reset-passphrase-7Qz!";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type Json = Record<string, unknown>;

d("T-003-B22 viewer verdicts on shipped routes (E2E, DB+Redis)", () => {
  let app: TestApp;
  let prisma: PrismaClient;
  let redis: Redis;
  let kit: F003SeedKit;

  const token = (userId: string): string =>
    app.app.get(AccessTokenService, { strict: false }).sign(userId);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await prisma.$connect();
    redis = new Redis(process.env.TEST_REDIS_URL!);
    app = await createTestApp();
    kit = createF003SeedKit(prisma, { label: "b22" });
  });

  afterAll(async () => {
    if (kit) await kit.cleanup();
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
    if (redis) redis.disconnect();
  });

  const personas = () => kit.scenario("f003-personas") as Promise<F003PersonasResult>;
  const as = (shop: PersonaShop, p: PersonaKey) => `Bearer ${token(shop.users[p].id)}`;
  const get = (path: string, auth: string) =>
    request(app.server()).get(path).set("Authorization", auth);
  const send = (method: "post" | "patch" | "delete", path: string, auth: string, body?: object) => {
    const req = request(app.server())[method](path).set("Authorization", auth);
    return body ? req.set("Content-Type", "application/json").send(body) : req;
  };
  const items = (res: request.Response): Json[] => {
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body.items as Json[];
  };
  const holds = (shop: PersonaShop, p: PersonaKey, cap: string) => {
    const roleId = shop.memberships[p].roleId;
    const role = [...Object.values(shop.org.roles), ...Object.values(shop.customRoles)].find(
      (r) => r.id === roleId,
    )!;
    return role.capabilities.includes("full_access") || role.capabilities.includes(cap);
  };

  // ── I3-22 ────────────────────────────────────────────────────────────────

  describe("I3-22 ★ AC-6.4 — who sees which verdict", () => {
    let s: F003PersonasResult;
    let A: PersonaShop;
    beforeAll(async () => {
      s = await personas();
      A = s.shops.A;
    });

    it("GET /roles: no `capabilities` key for any of 5 personas · viewerCanAssign only with manage_members", async () => {
      const five: PersonaKey[] = ["OWN", "ADM_A", "STF", "MR", "MM"];
      let withVerdict = 0;
      for (const p of five) {
        const rows = items(await get(`/orgs/${A.org.id}/roles`, as(A, p)));
        expect(rows.length).toBeGreaterThan(3);
        for (const row of rows) {
          expect(Object.keys(row), p).not.toContain("capabilities");
          expect(typeof row.nameCustomized, p).toBe("boolean");
          if (holds(A, p, "manage_members")) {
            expect(typeof row.viewerCanAssign, `${p} ${row.name}`).toBe("boolean");
            withVerdict++;
          } else {
            expect(Object.keys(row), p).not.toContain("viewerCanAssign");
            expect(Object.keys(row), p).not.toContain("assignBlockedReason");
          }
        }
        expect(JSON.stringify(rows), p).not.toContain("full_access");
      }
      expect(withVerdict).toBeGreaterThan(10);

      const byName = (p: PersonaKey) =>
        get(`/orgs/${A.org.id}/roles`, as(A, p)).then((r) =>
          Object.fromEntries(items(r).map((row) => [row.id, row])),
        );
      const adm = await byName("ADM_A");
      expect(adm[A.org.roles.Owner.id]).toMatchObject({
        viewerCanAssign: false,
        assignBlockedReason: "owner_only",
      });
      expect(adm[A.customRoles.R_B.id]).toMatchObject({
        viewerCanAssign: true,
        assignBlockedReason: null,
      });
      const mm = await byName("MM");
      expect(mm[A.org.roles.Staff.id]).toMatchObject({
        viewerCanAssign: false,
        assignBlockedReason: "exceeds_your_permissions",
      });
      expect(mm[A.customRoles.R_MM.id]).toMatchObject({ viewerCanAssign: true });
    });

    it("GET /members: verdict keys ABSENT for MM, present for ADM_A on active rows only", async () => {
      const VERDICT = [
        "viewerCanManage",
        "manageBlockedReason",
        "viewerCanResetPassword",
        "resetBlockedReason",
      ];
      for (const row of items(await get(`/orgs/${A.org.id}/members`, as(A, "MM")))) {
        for (const k of VERDICT) expect(Object.keys(row)).not.toContain(k);
        expect(typeof row.roleNameCustomized).toBe("boolean");
      }
      const rows = items(await get(`/orgs/${A.org.id}/members`, as(A, "ADM_A")));
      const byUser = Object.fromEntries(rows.map((r) => [r.userId, r]));
      for (const row of rows) {
        for (const k of VERDICT) {
          if (row.status === "active") expect(Object.keys(row), String(row.userId)).toContain(k);
          else expect(Object.keys(row)).not.toContain(k);
        }
      }
      expect(byUser[A.users.REV.id]!.status).toBe("revoked");
      expect(byUser[A.users.OWN.id]).toMatchObject({
        viewerCanManage: false,
        manageBlockedReason: "owner_only",
        resetBlockedReason: "owner_only",
      });
      expect(byUser[A.users.ADM_B.id]).toMatchObject({
        viewerCanManage: false,
        manageBlockedReason: "equal_permissions",
        viewerCanResetPassword: false,
        resetBlockedReason: "equal_permissions",
      });
      expect(byUser[A.users.ADM_A.id]).toMatchObject({
        isMe: true,
        viewerCanManage: true,
        viewerCanResetPassword: false,
        resetBlockedReason: "self",
      });
      expect(byUser[A.users.STF.id]).toMatchObject({
        viewerCanManage: true,
        manageBlockedReason: null,
        viewerCanResetPassword: true,
        resetBlockedReason: null,
      });
      // The gate of the route did not move (AC-2.5).
      expect((await get(`/orgs/${A.org.id}/members`, as(A, "MR"))).status).toBe(403);
    });

    it("GET /invitations: viewerCanManage on stored-pending rows (expired too) for manage_members holders", async () => {
      for (const p of ["MM", "ADM_A", "OWN"] as const) {
        const pending = items(await get(`/orgs/${A.org.id}/invitations?status=pending`, as(A, p)));
        const expired = items(await get(`/orgs/${A.org.id}/invitations?status=expired`, as(A, p)));
        expect(pending.length).toBeGreaterThan(0);
        expect(expired.length).toBeGreaterThan(0);
        for (const row of [...pending, ...expired]) {
          expect(typeof row.viewerCanManage, `${p} ${row.status}`).toBe("boolean");
          expect(JSON.stringify(row)).not.toContain("capabilities");
        }
        for (const status of ["accepted", "cancelled"]) {
          const done = items(await get(`/orgs/${A.org.id}/invitations?status=${status}`, as(A, p)));
          expect(done.length).toBeGreaterThan(0);
          for (const row of done) expect(Object.keys(row)).not.toContain("viewerCanManage");
        }
      }
      const mm = items(await get(`/orgs/${A.org.id}/invitations?status=pending`, as(A, "MM")));
      const staffInv = mm.find((r) => r.id === A.invitations.pending.id)!;
      expect(staffInv).toMatchObject({
        viewerCanManage: false,
        manageBlockedReason: "exceeds_your_permissions",
      });
      expect((await get(`/orgs/${A.org.id}/invitations`, as(A, "MR"))).status).toBe(403);
    });

    it("records the normalised responses as the client golden fixture (G3-14)", async () => {
      const labels = labelMap(s);
      const golden: Json = {};
      for (const p of ["OWN", "ADM_A", "MM", "STF"] as const) {
        golden[`GET /roles as ${p}`] = normalise(
          (await get(`/orgs/${A.org.id}/roles`, as(A, p))).body,
          labels,
        );
      }
      for (const p of ["ADM_A", "MM"] as const) {
        golden[`GET /members as ${p}`] = normalise(
          (await get(`/orgs/${A.org.id}/members`, as(A, p))).body,
          labels,
        );
        golden[`GET /invitations?status=pending as ${p}`] = normalise(
          (await get(`/orgs/${A.org.id}/invitations?status=pending`, as(A, p))).body,
          labels,
        );
      }
      await expect(JSON.stringify(golden, null, 2) + "\n").toMatchFileSnapshot(
        "./__golden__/f003-i3-22.viewer-verdicts.json",
      );
    });
  });

  // ── I3-23 ────────────────────────────────────────────────────────────────

  describe("I3-23 ★ verdict ⇔ write", () => {
    const awaited = new Set<string>();

    /** A `false` verdict: the write must refuse with `code` — or, while awaited, still answer F-002's way. */
    const expectRefused = (
      res: request.Response,
      code: string,
      rule: string | null,
      what: string,
    ) => {
      if (rule && AWAITING_WRITE_RULE[rule]) {
        expect(
          res.status,
          `${what}: "${rule}" now refuses — ${AWAITING_WRITE_RULE[rule]} landed; delete it from AWAITING_WRITE_RULE`,
        ).toBeLessThan(300);
        awaited.add(rule);
        return;
      }
      expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBe(403);
      expect(res.body.error.code, what).toBe(code);
    };

    const clearThrottle = (userId: string) =>
      redis.del(`${THROTTLE_ACCT_PREFIX}${userId}:reset-password`);

    it("MemberRow (viewer ADM_A): every verdict vs PATCH-to-same-role and reset-password", async () => {
      const { shops } = await personas();
      const A = shops.A;
      const auth = as(A, "ADM_A");
      const rows = items(await get(`/orgs/${A.org.id}/members?status=active`, auth));
      let refusals = 0;
      let passes = 0;
      for (const row of rows) {
        const what = `ADM_A → ${row.userId}`;
        const patch = await send("patch", `/orgs/${A.org.id}/members/${row.userId}`, auth, {
          roleId: row.roleId,
        });
        if (row.viewerCanManage === false) {
          refusals++;
          if (row.manageBlockedReason === "owner_only")
            expectRefused(patch, "FORBIDDEN", null, what);
          else expectRefused(patch, "TARGET_NOT_BELOW_ACTOR", MEMBER_TARGET, what);
        } else {
          passes++;
          expect(patch.status, `${what}: ${JSON.stringify(patch.body)}`).toBe(200);
          // The 200 body is a MemberRow too, with the verdict from the tx-read actor caps.
          expect(patch.body.viewerCanManage, what).toBe(true);
        }

        await clearThrottle(A.users.ADM_A.id);
        const reset = await send(
          "post",
          `/orgs/${A.org.id}/members/${row.userId}/reset-password`,
          auth,
          { newPassword: NEW_PW },
        );
        // Admin-reset never answers 403 (uniform 404 — api-spec §6). C-2 (target
        // active in another shop) can still 404 a `true`; this shop's ⊊ targets
        // are not members elsewhere, so `true` must be 200 here.
        expect(reset.status, `reset ${what}`).toBe(row.viewerCanResetPassword ? 200 : 404);
      }
      expect(refusals).toBeGreaterThanOrEqual(4); // OWN, OWN2, ADM_B, activeInBoth
      expect(passes).toBeGreaterThanOrEqual(5);

      // DELETE leg (the same verdict covers "remove"). Last, because it revokes.
      // The caller's own row is skipped: removing yourself ends this session.
      let removed = 0;
      for (const row of rows.filter((r) => r.userId !== A.users.ADM_A.id)) {
        const what = `ADM_A removes ${row.userId}`;
        const res = await send("delete", `/orgs/${A.org.id}/members/${row.userId}`, auth);
        if (row.viewerCanManage === false) {
          if (row.manageBlockedReason === "owner_only") expectRefused(res, "FORBIDDEN", null, what);
          else expectRefused(res, "TARGET_NOT_BELOW_ACTOR", MEMBER_REMOVE, what);
        } else {
          expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBe(200);
          removed++;
        }
      }
      expect(removed).toBeGreaterThanOrEqual(4);
    });

    it("RoleRow.viewerCanAssign (viewers ADM_A, MM) vs POST /invitations with that role", async () => {
      const { shops } = await personas();
      const A = shops.A;
      let n = 0;
      for (const p of ["ADM_A", "MM"] as const) {
        const roles = items(await get(`/orgs/${A.org.id}/roles`, as(A, p)));
        for (const role of roles) {
          const res = await send("post", `/orgs/${A.org.id}/invitations`, as(A, p), {
            email: `b22-i323-${p}-${n++}-${Date.now()}@seed.test`.toLowerCase(),
            roleId: role.id,
          });
          const what = `${p} invites as ${role.name}`;
          if (role.viewerCanAssign === false) {
            if (role.assignBlockedReason === "owner_only")
              expectRefused(res, "FORBIDDEN", null, what);
            else expectRefused(res, "ROLE_EXCEEDS_ACTOR", null, what);
          } else {
            expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBe(201);
            expect(res.body.invitation.viewerCanManage, what).toBe(true);
          }
        }
      }
    });

    it("Invitation.viewerCanManage vs cancel: ADM_A true rows cancel · MM false rows", async () => {
      const { shops } = await personas();
      const A = shops.A;
      const mm = items(await get(`/orgs/${A.org.id}/invitations?status=pending`, as(A, "MM")));
      const falses = mm.filter((r) => r.viewerCanManage === false);
      expect(falses.length).toBeGreaterThan(0);
      for (const row of falses) {
        const res = await send("delete", `/orgs/${A.org.id}/invitations/${row.id}`, as(A, "MM"));
        expectRefused(
          res,
          row.manageBlockedReason === "owner_only" ? "FORBIDDEN" : "ROLE_EXCEEDS_ACTOR",
          null,
          `MM cancels ${row.id}`,
        );
      }
      const B = shops.B;
      const adm = items(await get(`/orgs/${B.org.id}/invitations?status=pending`, as(B, "ADM_A")));
      const trues = adm.filter((r) => r.viewerCanManage === true);
      expect(trues.length).toBeGreaterThan(0);
      for (const row of trues) {
        const res = await send("delete", `/orgs/${B.org.id}/invitations/${row.id}`, as(B, "ADM_A"));
        expect(res.status, JSON.stringify(res.body)).toBe(200);
      }
    });

    afterAll(() => {
      if (awaited.size > 0) {
        console.warn(
          `[T-003-B22 I3-23] verdict ⇔ write still awaiting the write rule of: ${[...awaited]
            .map((r) => `${r} (${AWAITING_WRITE_RULE[r]})`)
            .join(" · ")}`,
        );
      }
    });
  });

  // ── I3-54 ────────────────────────────────────────────────────────────────

  describe("I3-54 AC-1.5 — roleNameCustomized agrees on all six schemas after renaming Staff", () => {
    it("control (before) false → rename → true everywhere; Admin stays false; custom role true", async () => {
      const { shops } = await personas();
      const A = shops.A;
      const staffId = A.org.roles.Staff.id;
      const staffAuth = as(A, "STF");
      const before = await get(`/orgs/${A.org.id}`, staffAuth);
      expect(before.status).toBe(200);
      expect(before.body.myMembership.roleNameCustomized).toBe(false);
      const rolesBefore = items(await get(`/orgs/${A.org.id}/roles`, staffAuth));
      expect(rolesBefore.find((r) => r.id === staffId)!.nameCustomized).toBe(false);

      // The rename route is B24; the column it writes is what is under test here.
      await prisma.role.update({
        where: { id: staffId },
        data: { name: "พนักงานแพ็ค", nameCustomized: true },
      });

      // RoleRow
      const roles = Object.fromEntries(
        items(await get(`/orgs/${A.org.id}/roles`, staffAuth)).map((r) => [r.id, r]),
      );
      expect(roles[staffId]!.nameCustomized).toBe(true);
      expect(roles[A.org.roles.Admin.id]!.nameCustomized).toBe(false);
      expect(roles[A.customRoles.R_T.id]!.nameCustomized).toBe(true); // key null
      // OrgMyMembership
      const org = await get(`/orgs/${A.org.id}`, staffAuth);
      expect(org.body.myMembership).toMatchObject({
        roleName: "พนักงานแพ็ค",
        roleNameCustomized: true,
      });
      expect(
        (await get(`/orgs/${A.org.id}`, as(A, "ADM_A"))).body.myMembership.roleNameCustomized,
      ).toBe(false);
      // MyOrganizationMembership
      const mine = await get("/me/organizations", staffAuth);
      expect(mine.status).toBe(200);
      const item = (mine.body.items as Json[]).find(
        (i) => (i.organization as Json).id === A.org.id,
      )!;
      expect(item.membership).toMatchObject({ roleId: staffId, roleNameCustomized: true });
      // MemberRow
      const members = Object.fromEntries(
        items(await get(`/orgs/${A.org.id}/members`, as(A, "OWN"))).map((r) => [r.userId, r]),
      );
      expect(members[A.users.STF.id]!.roleNameCustomized).toBe(true);
      expect(members[A.users.ADM_A.id]!.roleNameCustomized).toBe(false);
      // Invitation
      const invs = Object.fromEntries(
        items(await get(`/orgs/${A.org.id}/invitations?status=pending`, as(A, "OWN"))).map((r) => [
          r.id,
          r,
        ]),
      );
      expect(invs[A.invitations.pending.id]!.roleNameCustomized).toBe(true);
      expect(invs[A.invitations.byAdmA.id]!.roleNameCustomized).toBe(true); // R_T, key null
      // InvitationPreview (public)
      const preview = await request(app.server())
        .post("/invitations/preview")
        .set("Content-Type", "application/json")
        .send({ token: A.invitations.pending.rawToken });
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body).toMatchObject({ roleName: "พนักงานแพ็ค", roleNameCustomized: true });
      // AcceptedMembership
      const invitee = await kit.createUser({ email: `b22-i354-${Date.now()}@seed.test` });
      const inv = await kit.createInvitation({
        organizationId: A.org.id,
        email: invitee.email,
        roleId: staffId,
        issuedByUserId: A.users.OWN.id,
      });
      const accepted = await request(app.server())
        .post("/invitations/accept")
        .set("Authorization", `Bearer ${token(invitee.id)}`)
        .set("Content-Type", "application/json")
        .send({ token: inv.rawToken });
      expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
      expect(accepted.body.membership).toMatchObject({ roleId: staffId, roleNameCustomized: true });
    });
  });

  // ── ?roleId ──────────────────────────────────────────────────────────────

  describe("?roleId filter (api-spec §4.2b)", () => {
    it("members: AND with status · other shop's role = 200 empty · deleted role still filters · 65 chars = 422", async () => {
      const { shops } = await personas();
      const { A, B } = shops;
      const auth = as(A, "OWN");
      const ids = (res: request.Response) =>
        items(res)
          .map((r) => r.userId)
          .sort();

      expect(
        ids(await get(`/orgs/${A.org.id}/members?roleId=${A.org.roles.Staff.id}`, auth)),
      ).toEqual([A.users.STF.id]);
      expect(
        ids(await get(`/orgs/${A.org.id}/members?roleId=${A.org.roles.Owner.id}`, auth)),
      ).toEqual([A.users.OWN.id, A.users.OWN2.id].sort());
      const withTotal = await get(
        `/orgs/${A.org.id}/members?roleId=${A.org.roles.Owner.id}&withTotal=true`,
        auth,
      );
      expect(withTotal.body.total).toBe(2);
      expect(
        ids(
          await get(
            `/orgs/${A.org.id}/members?roleId=${A.customRoles.R_HIST.id}&status=active`,
            auth,
          ),
        ),
      ).toEqual([]);
      expect(
        ids(
          await get(
            `/orgs/${A.org.id}/members?roleId=${A.customRoles.R_HIST.id}&status=revoked`,
            auth,
          ),
        ),
      ).toEqual([A.users.REV.id]);
      // Another shop's role id: an empty page, never an error (no existence oracle).
      expect(
        ids(await get(`/orgs/${A.org.id}/members?roleId=${B.org.roles.Staff.id}`, auth)),
      ).toEqual([]);
      // A soft-deleted role still filters (its holders' history).
      await kit.softDeleteRole(A.org.id, A.customRoles.R_HIST.id);
      expect(
        ids(
          await get(`/orgs/${A.org.id}/members?roleId=${A.customRoles.R_HIST.id}&status=all`, auth),
        ),
      ).toEqual([A.users.REV.id]);
      const tooLong = await get(`/orgs/${A.org.id}/members?roleId=${"r".repeat(65)}`, auth);
      expect(tooLong.status).toBe(422);
      expect(tooLong.body.error).toMatchObject({
        code: "VALIDATION_FAILED",
        fieldErrors: { roleId: expect.any(String) },
      });
    });

    it("invitations: AND with status · R_T → byAdmA only · 65 chars = 422", async () => {
      const { shops } = await personas();
      const A = shops.A;
      const auth = as(A, "OWN");
      const ids = (res: request.Response) =>
        items(res)
          .map((r) => r.id)
          .sort();
      expect(
        ids(await get(`/orgs/${A.org.id}/invitations?roleId=${A.customRoles.R_T.id}`, auth)),
      ).toEqual([A.invitations.byAdmA.id]);
      expect(
        ids(
          await get(
            `/orgs/${A.org.id}/invitations?status=pending&roleId=${A.org.roles.Staff.id}`,
            auth,
          ),
        ),
      ).toEqual([A.invitations.pending.id, A.invitations.reissuedByOwn.id].sort());
      expect(
        ids(
          await get(
            `/orgs/${A.org.id}/invitations?status=expired&roleId=${A.org.roles.Staff.id}`,
            auth,
          ),
        ),
      ).toEqual([A.invitations.expired.id]);
      expect(
        ids(
          await get(
            `/orgs/${A.org.id}/invitations?status=pending&roleId=${A.customRoles.R_MM.id}`,
            auth,
          ),
        ),
      ).toEqual([]);
      const tooLong = await get(`/orgs/${A.org.id}/invitations?roleId=${"r".repeat(65)}`, auth);
      expect(tooLong.status).toBe(422);
    });
  });
});

// ── golden-fixture normalisation ───────────────────────────────────────────

/** Every id / email the seed minted → a stable label, so the fixture is run-independent. */
function labelMap(s: F003PersonasResult): Map<string, string> {
  const m = new Map<string, string>();
  for (const tag of ["A", "B"] as const) {
    const shop = s.shops[tag];
    m.set(shop.org.id, `org:${tag}`);
    for (const [name, role] of Object.entries(shop.org.roles))
      m.set(role.id, `role:${tag}:${name}`);
    for (const [k, role] of Object.entries(shop.customRoles)) m.set(role.id, `role:${tag}:${k}`);
    for (const p of PERSONA_KEYS) {
      m.set(shop.users[p].id, `user:${tag}:${p}`);
      m.set(shop.users[p].email, `email:${tag}:${p}`);
    }
    for (const [k, inv] of Object.entries(shop.invitations)) {
      m.set(inv.id, `inv:${tag}:${k}`);
      m.set(inv.email, `email:${tag}:inv-${k}`);
    }
  }
  m.set(s.activeInBoth.user.id, "user:activeInBoth");
  m.set(s.activeInBoth.user.email, "email:activeInBoth");
  return m;
}

function normalise(body: unknown, labels: Map<string, string>): unknown {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return labels.get(v) ?? (ISO.test(v) ? "<timestamp>" : v);
    if (Array.isArray(v)) {
      const out = v.map(walk);
      // Keyset order follows createdAt, which ties inside one seed: sort by label.
      return out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v as Json)
          .sort()
          .map((k) => [k, walk((v as Json)[k])]),
      );
    }
    return v;
  };
  return walk(body);
}
