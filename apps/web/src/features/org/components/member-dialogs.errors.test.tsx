// T-003-W10 ★ — R7 · §E: what happens when the F-002 fallback offered an
// action the server then refused (viewer without `manage_roles` gets no
// verdict, so it can still press change/remove on an equal-permission member).
//
// Before W10 a `403 TARGET_NOT_BELOW_ACTOR` fell into the generic `forbidden`
// branch and told the person "only an Owner can change an Owner" — about a
// member who is not an Owner. And the list kept offering the same action.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let failWith: unknown = null;
const removeMutate = vi.fn((_id: string, opts: { onError: (e: unknown) => void }) =>
  opts.onError(failWith),
);
const changeMutate = vi.fn((_v: unknown, opts: { onError: (e: unknown) => void }) =>
  opts.onError(failWith),
);
vi.mock("../api/use-member-mutations", () => ({
  useRemoveMember: () => ({ mutate: removeMutate, isPending: false }),
  useChangeMemberRole: () => ({ mutate: changeMutate, isPending: false }),
}));
vi.mock("../api/use-members", () => ({
  useRoles: () => ({
    data: {
      items: [
        { id: "rol_admin", name: "Admin", key: "admin", isSystem: false },
        { id: "rol_staff", name: "Staff", key: "staff", isSystem: false },
      ],
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { RemoveMemberDialog } from "./RemoveMemberDialog";
import { ChangeRoleDialog } from "./ChangeRoleDialog";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { ToastProvider } from "../../../components/providers/ToastProvider";
import { ApiRequestError } from "../../../lib/api/error";
import { orgKey } from "../../../lib/org/org-keys";

const ORG: ActiveOrg = {
  orgId: "org_1",
  name: "ร้าน",
  capabilities: new Set(["manage_members"]),
  roleKey: null,
  roleName: "Team lead",
  profile: { myMembership: { roleId: "rol_lead" } } as unknown as ActiveOrg["profile"],
} as unknown as ActiveOrg;

let queryClient: QueryClient;
function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ActiveOrgProvider value={ORG}>
        <ToastProvider>{ui}</ToastProvider>
      </ActiveOrgProvider>
    </QueryClientProvider>,
  );
}

const MEMBER = { userId: "usr_b", email: "b@shop.com", roleId: "rol_admin", isOwner: false };
const NOT_BELOW = () =>
  new ApiRequestError(403, { error: { code: "TARGET_NOT_BELOW_ACTOR", message: "x" } });
const THROTTLED = () =>
  new ApiRequestError(429, { error: { code: "RATE_LIMITED", message: "x" } }, 75);

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  removeMutate.mockClear();
  changeMutate.mockClear();
});

async function pressRemove() {
  wrap(<RemoveMemberDialog member={MEMBER} onClose={vi.fn()} />);
  await userEvent.setup().click(screen.getByRole("button", { name: /^ถอด/ }));
}

async function pressChange() {
  wrap(<ChangeRoleDialog member={MEMBER} ownerRoleIds={new Set()} onClose={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: /พนักงาน/ }));
  await user.click(screen.getByRole("button", { name: "บันทึกบทบาท" }));
}

describe("§E · 403 TARGET_NOT_BELOW_ACTOR", () => {
  it.each([
    ["remove", pressRemove],
    ["change role", pressChange],
  ])(
    "★ %s → 'คุณจัดการสมาชิกคนนี้ไม่ได้' + members refetched for a fresh verdict",
    async (_n, press) => {
      failWith = NOT_BELOW();
      const spy = vi.spyOn(queryClient, "invalidateQueries");
      await press();
      expect(
        screen.getByText("คุณจัดการสมาชิกคนนี้ไม่ได้ — ให้เจ้าของร้านช่วย"),
      ).toBeInTheDocument();
      expect(screen.queryByText(/เฉพาะเจ้าของร้านเท่านั้น/)).toBeNull();
      expect(spy).toHaveBeenCalledWith({ queryKey: orgKey("org_1", "members") });
    },
  );
});

describe("§E · 429 RATE_LIMITED (memberWrite) · UX01", () => {
  it.each([
    ["remove", pressRemove],
    ["change role", pressChange],
  ])("%s → the member-route throttle sentence with mm:ss", async (_n, press) => {
    failWith = THROTTLED();
    await press();
    expect(
      screen.getByText("ทำรายการกับสมาชิกถี่เกินไป กรุณารอ 01:15 แล้วลองใหม่"),
    ).toBeInTheDocument();
  });
});
