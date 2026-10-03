import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { decodeClientHeic } from "./clientHeicDecoder";

describe("decodeClientHeic", () => {
  it("decodes a real HEIC source for client-side normalization", async () => {
    const bytes = await readFile(
      new URL("./__fixtures__/single-frame.heic", import.meta.url),
    );
    const file = Object.assign(new Blob([bytes], { type: "image/heic" }), {
      name: "phone-photo.heic",
      lastModified: 0,
    }) as File;

    const decoded = await decodeClientHeic(file);

    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
    expect(decoded.data).toBeInstanceOf(Uint8ClampedArray);
    expect(decoded.data.byteLength).toBe(decoded.width * decoded.height * 4);
  });
});
