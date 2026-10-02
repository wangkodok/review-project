import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("../lib/auth/options", () => ({ authOptions: {} }));
vi.mock("../components/community/CommunityList", () => ({
  default: ({ isAuthenticated }: { isAuthenticated: boolean }) =>
    `authenticated:${isAuthenticated}`,
}));

import CommunityPage from "./page";

describe("CommunityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(null);
  });

  it("renders the community list as a guest without menu query handling", async () => {
    const html = renderToStaticMarkup(await CommunityPage());

    expect(html).toContain("authenticated:false");
  });

  it("renders the community list for an authenticated session", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-id" } });
    const html = renderToStaticMarkup(await CommunityPage());

    expect(html).toContain("authenticated:true");
  });
});
