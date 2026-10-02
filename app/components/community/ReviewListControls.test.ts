import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import * as ReviewListControlsModule from "./ReviewListControls";

const ReviewListControls = ReviewListControlsModule.default;
const shouldStartFilterRailDrag = (
  ReviewListControlsModule as typeof ReviewListControlsModule & {
    shouldStartFilterRailDrag?: (input: {
      button: number;
      isPrimary: boolean;
      pointerType: string;
    }) => boolean;
  }
).shouldStartFilterRailDrag;

describe("ReviewListControls", () => {
  it("shows only the previous region and category filters", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewListControls, {
        categoryActive: false,
        categoryDisabled: false,
        categoryLabel: "카테고리",
        count: 7,
        filtersActive: false,
        onCategoryClick: vi.fn(),
        onClearFilters: vi.fn(),
        onRegionClick: vi.fn(),
        onSortChange: vi.fn(),
        regionActive: false,
        regionDisabled: false,
        regionLabel: "지역",
        sort: "latest",
      } as never),
    );

    expect(html).toContain("지역");
    expect(html).toContain("카테고리");
    expect(html).not.toContain("사진 있는 리뷰");
    expect(html).toContain("전체 초기화");
  });

  it("allows native horizontal touch scrolling on mobile", () => {
    const html = renderToStaticMarkup(
      createElement(ReviewListControls, {
        categoryActive: false,
        categoryDisabled: false,
        categoryLabel: "카테고리",
        count: 7,
        filtersActive: false,
        onCategoryClick: vi.fn(),
        onClearFilters: vi.fn(),
        onRegionClick: vi.fn(),
        onSortChange: vi.fn(),
        regionActive: false,
        regionDisabled: false,
        regionLabel: "지역",
        sort: "latest",
      } as never),
    );

    expect(html).toContain("touch-auto");
    expect(html).not.toContain("touch-pan-y");
    expect(
      shouldStartFilterRailDrag?.({
        button: 0,
        isPrimary: true,
        pointerType: "touch",
      }),
    ).toBe(false);
  });

  it("keeps custom drag scrolling for the primary mouse button", () => {
    expect(
      shouldStartFilterRailDrag?.({
        button: 0,
        isPrimary: true,
        pointerType: "mouse",
      }),
    ).toBe(true);
  });
});
