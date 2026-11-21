// R8 · the "what does each role allow" link under the role picker.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RoleCapabilitiesLink } from "./RoleCapabilitiesLink";
import { ActiveOrgProvider, type ActiveOrg } from "../../../lib/org/org-context";
import { roleCapabilitiesLinkLabel } from "../role-copy";

function renderWith(capabilities: string[]) {
  const org: ActiveOrg = {
    orgId: "org_1",
    name: "ร้าน",
    capabilities: new Set(capabilities),
    roleKey: "admin",
    roleName: "Admin",
    profile: {} as ActiveOrg["profile"],
  };
  return render(
    <ActiveOrgProvider value={org}>
      <RoleCapabilitiesLink />
    </ActiveOrgProvider>,
  );
}

describe("RoleCapabilitiesLink (R8)", () => {
  it("opens the roles list in a new tab, for a manage_roles holder", () => {
    renderWith(["manage_roles"]);
    const link = screen.getByRole("link", { name: new RegExp(roleCapabilitiesLinkLabel) });
    expect(link).toHaveAttribute("href", "/o/org_1/settings/roles");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("is not rendered without manage_roles (AC-6.4)", () => {
    renderWith(["manage_members"]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("★ is a 44px tap target, not a 17px inline text link (D-038 ③)", () => {
    // Measured in the manual pass at 194x17 inside the invite dialog — the
    // smallest thing a finger had to hit on that screen.
    renderWith(["manage_roles"]);
    const link = screen.getByRole("link", { name: new RegExp(roleCapabilitiesLinkLabel) });
    expect(link.className).toContain("min-h-[var(--size-tap-target-min)]");
  });
});
