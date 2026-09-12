import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getProfile: vi.fn(),
  isValidNickname: vi.fn(),
  updateNickname: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/app/lib/auth/options", () => ({ authOptions: {} }));
vi.mock("@/app/lib/profile/service", () => ({
  getProfile: mocks.getProfile,
  isValidNickname: mocks.isValidNickname,
  updateNickname: mocks.updateNickname,
}));

import { GET, PATCH } from "./route";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session = { user: { id: USER_ID, authProvider: "kakao" } };
const profile = { id: USER_ID, nickname: "리뷰어" };

describe("/api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(session);
    mocks.getProfile.mockResolvedValue(profile);
    mocks.isValidNickname.mockReturnValue(true);
    mocks.updateNickname.mockResolvedValue({ status: "ok", user: profile });
  });

  it("returns a private non-cacheable profile", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      success: true,
      data: { user: profile },
    });
    expect(mocks.getProfile).toHaveBeenCalledWith(USER_ID, "kakao");
  });

  it("rejects unauthenticated profile reads without storage access", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });

  it("rejects an invalid nickname before updating storage", async () => {
    mocks.isValidNickname.mockReturnValue(false);

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "x" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).code).toBe("INVALID_NICKNAME");
    expect(mocks.updateNickname).not.toHaveBeenCalled();
  });

  it("maps the nickname cooldown to 429", async () => {
    mocks.updateNickname.mockResolvedValue({ status: "limited" });

    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: " 리뷰어 " }),
      }),
    );

    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("NICKNAME_CHANGE_LIMIT");
    expect(mocks.updateNickname).toHaveBeenCalledWith({
      userId: USER_ID,
      nickname: "리뷰어",
      authProvider: "kakao",
    });
  });

  it("returns the updated profile", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "리뷰어" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ data: { user: profile } });
  });

  it("does not expose an internal profile error", async () => {
    mocks.getProfile.mockRejectedValue(new Error("private database detail"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
