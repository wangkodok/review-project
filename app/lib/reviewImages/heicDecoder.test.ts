import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decodeSingleHeic } from "./heicDecoder";

type MockFrame = {
  width: number;
  height: number;
  decode: () => Promise<{
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }>;
};

function createDecodeResult(frames: MockFrame[], dispose = vi.fn()) {
  return Object.assign(frames, { dispose });
}

describe("decodeSingleHeic", () => {
  it("decodes the single-frame HEIC fixture", async () => {
    const fixture = await readFile(
      new URL("./__fixtures__/single-frame.heic", import.meta.url),
    );

    const result = await decodeSingleHeic(fixture);

    expect(result.width).toBe(480);
    expect(result.height).toBe(640);
    expect(result.data).toBeInstanceOf(Uint8ClampedArray);
    expect(result.data.byteLength).toBe(480 * 640 * 4);
  });

  it("disposes a successfully decoded frame collection", async () => {
    const dispose = vi.fn();
    const decodeAll = vi.fn().mockResolvedValue(
      createDecodeResult(
        [
          {
            width: 1,
            height: 1,
            decode: vi.fn().mockResolvedValue({
              width: 1,
              height: 1,
              data: new Uint8ClampedArray([1, 2, 3, 4]),
            }),
          },
        ],
        dispose,
      ),
    );

    await expect(
      decodeSingleHeic(new Uint8Array([1]), decodeAll),
    ).resolves.toMatchObject({ width: 1, height: 1 });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([0, 2])("rejects a HEIC container with %d images", async (count) => {
    const dispose = vi.fn();
    const frames = Array.from({ length: count }, () => ({
      width: 1,
      height: 1,
      decode: vi.fn().mockResolvedValue({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
      }),
    }));
    const decodeAll = vi.fn().mockResolvedValue(createDecodeResult(frames, dispose));

    await expect(
      decodeSingleHeic(new Uint8Array([1]), decodeAll),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE", status: 422 });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects decoded RGBA data with an invalid length", async () => {
    const dispose = vi.fn();
    const decodeAll = vi.fn().mockResolvedValue(
      createDecodeResult(
        [
          {
            width: 2,
            height: 2,
            decode: vi.fn().mockResolvedValue({
              width: 2,
              height: 2,
              data: new Uint8ClampedArray(15),
            }),
          },
        ],
        dispose,
      ),
    );

    await expect(
      decodeSingleHeic(new Uint8Array([1]), decodeAll),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("rejects dimensions over 20 million pixels before decoding RGBA", async () => {
    const dispose = vi.fn();
    const decode = vi.fn();
    const decodeAll = vi.fn().mockResolvedValue(
      createDecodeResult(
        [{ width: 5_000, height: 4_001, decode }],
        dispose,
      ),
    );

    await expect(
      decodeSingleHeic(new Uint8Array([1]), decodeAll),
    ).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    expect(decode).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("normalizes damaged HEIC decoder errors and still disposes", async () => {
    const dispose = vi.fn();
    const decodeAll = vi.fn().mockResolvedValue(
      createDecodeResult(
        [
          {
            width: 1,
            height: 1,
            decode: vi.fn().mockRejectedValue(new Error("private decoder detail")),
          },
        ],
        dispose,
      ),
    );

    await expect(
      decodeSingleHeic(new Uint8Array([1]), decodeAll),
    ).rejects.toMatchObject({
      code: "INVALID_IMAGE",
      status: 422,
      message: "사진 파일을 확인해 주세요.",
    });
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("does not expose a decoder error for damaged bytes", async () => {
    await expect(
      decodeSingleHeic(new Uint8Array([1, 2, 3])),
    ).rejects.toMatchObject({
      code: "INVALID_IMAGE",
      status: 422,
      message: "사진 파일을 확인해 주세요.",
    });
  });
});
