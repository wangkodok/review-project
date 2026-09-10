import { describe, expect, it } from "vitest";
import { formatActivityCount } from "./profileClient";

describe("formatActivityCount", () => {
  it.each([
    [0, "0"],
    [1_234, "1,234"],
    [9_999, "9,999"],
    [10_000, "10k"],
    [12_345, "12.3k"],
    [100_000, "100k"],
  ])("%i를 승인된 활동 수치 형식으로 표시한다", (value, expected) => {
    expect(formatActivityCount(value)).toBe(expected);
  });
});
