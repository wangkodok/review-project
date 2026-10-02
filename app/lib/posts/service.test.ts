import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  or: vi.fn(),
  order: vi.fn(),
  range: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../supabase/server", () => ({
  createSupabaseServerClient: () => ({ from: mocks.from }),
}));

import { getPosts } from "./service";

describe("getPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      select: mocks.select,
      eq: mocks.eq,
      or: mocks.or,
      order: mocks.order,
      range: mocks.range,
    };

    mocks.from.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.or.mockReturnValue(query);
    mocks.order.mockReturnValue(query);
    mocks.range.mockResolvedValue({ data: [], error: null, count: 0 });
  });

  it("filters and counts posts through an attached image inner relation", async () => {
    await getPosts({
      page: 1,
      limit: 10,
      search: "",
      sort: "latest",
      withImage: true,
    });

    expect(mocks.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "image:review_images!review_images_post_id_fkey!inner",
      ),
      { count: "exact" },
    );
    expect(mocks.eq).toHaveBeenCalledWith("review_images.status", "attached");
  });
});
