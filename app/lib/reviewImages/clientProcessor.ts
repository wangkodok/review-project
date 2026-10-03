import {
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_UPLOAD_BYTES,
} from "./constants";
import { decodeClientHeic } from "./clientHeicDecoder";
import type { DeclaredReviewImageMime } from "./uploadContract";

const OPTIMIZABLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_IMAGE_TYPES = new Set([
  ...OPTIMIZABLE_IMAGE_TYPES,
  "application/octet-stream",
]);
const OUTPUT_QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54];
const OUTPUT_EDGE_SCALES = [1, 0.9, 0.8, 0.7, 0.6];
const NORMALIZED_OUTPUT_IMAGE_TYPES = new Set<DeclaredReviewImageMime>([
  "image/webp",
  "image/jpeg",
]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx"]);
const HEIF_BRANDS = new Set(["mif1", "msf1"]);

export class ClientReviewImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientReviewImageError";
  }
}

export type PreparedClientReviewImage = {
  blob: Blob;
  mimeType: DeclaredReviewImageMime;
  optimized: boolean;
};

type PrepareReviewImageOptions = {
  optimizeImage?: (file: File) => Promise<Blob>;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

function normalizeClientMimeType(type: string): DeclaredReviewImageMime {
  const normalized = type.trim().toLowerCase() || "application/octet-stream";

  if (!ALLOWED_IMAGE_TYPES.has(normalized)) {
    throw new ClientReviewImageError(
      "JPEG, PNG, WebP, HEIC, HEIF 사진만 올릴 수 있어요.",
    );
  }

  return normalized as DeclaredReviewImageMime;
}

export function validateReviewImageFile(file: Pick<File, "size" | "type">) {
  normalizeClientMimeType(file.type);

  if (file.size <= 0) {
    throw new ClientReviewImageError("사진 파일을 확인해 주세요.");
  }
}

function matchesBytes(input: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => input[offset + index] === value);
}

function readAscii(input: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...input.subarray(start, end));
}

export async function detectReviewImageMimeType(
  file: Blob,
): Promise<Exclude<DeclaredReviewImageMime, "application/octet-stream">> {
  const input = new Uint8Array(await file.slice(0, 32).arrayBuffer());

  if (matchesBytes(input, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (matchesBytes(input, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (readAscii(input, 0, 4) === "RIFF" && readAscii(input, 8, 12) === "WEBP") {
    return "image/webp";
  }

  if (readAscii(input, 4, 8) === "ftyp") {
    for (let offset = 8; offset + 4 <= input.byteLength; offset += 4) {
      const brand = readAscii(input, offset, offset + 4);
      if (HEIC_BRANDS.has(brand)) {
        return "image/heic";
      }
      if (HEIF_BRANDS.has(brand)) {
        return "image/heif";
      }
    }
  }

  throw new ClientReviewImageError("사진 파일 형식을 확인하지 못했습니다.");
}

function withMimeType(file: File, mimeType: DeclaredReviewImageMime) {
  if (file.type.toLowerCase() === mimeType) {
    return file;
  }

  return Object.assign(file.slice(0, file.size, mimeType), {
    name: file.name,
    lastModified: file.lastModified,
  }) as File;
}

export function getConstrainedImageDimensions(
  width: number,
  height: number,
  maxEdge: number,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maxEdge) ||
    maxEdge <= 0
  ) {
    throw new ClientReviewImageError("사진 크기를 확인하지 못했습니다.");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

type CanvasBlobEncoder = Pick<HTMLCanvasElement, "toBlob">;

function tryCanvasToBlob(
  canvas: CanvasBlobEncoder,
  mimeType: "image/webp" | "image/jpeg",
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, mimeType, quality);
    } catch {
      resolve(null);
    }
  });
}

export async function encodeReviewImageCanvas(
  canvas: CanvasBlobEncoder,
  quality: number,
) {
  const webp = await tryCanvasToBlob(canvas, "image/webp", quality);
  if (webp?.type.toLowerCase() === "image/webp") {
    return webp;
  }

  const jpeg = await tryCanvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg?.type.toLowerCase() === "image/jpeg") {
    return jpeg;
  }

  throw new ClientReviewImageError(
    "사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.",
  );
}

function toImageDataPixels(
  data: Uint8ClampedArray,
): Uint8ClampedArray<ArrayBuffer> {
  if (data.buffer instanceof ArrayBuffer) {
    return new Uint8ClampedArray(
      data.buffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  return Uint8ClampedArray.from(data) as Uint8ClampedArray<ArrayBuffer>;
}

async function loadHeicImage(file: File): Promise<LoadedImage> {
  const decoded = await decodeClientHeic(file);
  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new ClientReviewImageError("사진을 자동으로 처리하지 못했습니다.");
  }

  context.putImageData(
    new ImageData(toImageDataPixels(decoded.data), decoded.width, decoded.height),
    0,
    0,
  );

  return {
    source: canvas,
    width: decoded.width,
    height: decoded.height,
    dispose: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Some browsers reject imageOrientation options and can use the image fallback.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new ClientReviewImageError("사진 파일을 확인해 주세요."));
      element.src = objectUrl;
    });

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
  }

  if (file.type === "image/heic" || file.type === "image/heif") {
    return loadHeicImage(file);
  }

  throw new ClientReviewImageError("사진 파일을 확인해 주세요.");
}

async function optimizeReviewImageWithCanvas(file: File): Promise<Blob> {
  const loaded = await loadImage(file);

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      throw new ClientReviewImageError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.");
    }

    const initialEdge = Math.min(MAX_REVIEW_IMAGE_EDGE, Math.max(loaded.width, loaded.height));
    const outputEdges = OUTPUT_EDGE_SCALES.map((scale) =>
      Math.max(1, Math.round(initialEdge * scale)),
    );

    let smallestBlob: Blob | null = null;

    for (const maxEdge of outputEdges) {
      const dimensions = getConstrainedImageDimensions(
        loaded.width,
        loaded.height,
        maxEdge,
      );
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      context.clearRect(0, 0, dimensions.width, dimensions.height);
      context.drawImage(loaded.source, 0, 0, dimensions.width, dimensions.height);

      for (const quality of OUTPUT_QUALITIES) {
        const blob = await encodeReviewImageCanvas(canvas, quality);

        if (!smallestBlob || blob.size < smallestBlob.size) {
          smallestBlob = blob;
        }

        if (blob.size <= MAX_REVIEW_IMAGE_UPLOAD_BYTES) {
          return blob;
        }
      }
    }

    if (smallestBlob) {
      return smallestBlob;
    }

    throw new ClientReviewImageError("사진을 처리하지 못했습니다.");
  } finally {
    loaded.dispose();
  }
}

export async function prepareReviewImageForUpload(
  file: File,
  options: PrepareReviewImageOptions = {},
): Promise<PreparedClientReviewImage> {
  validateReviewImageFile(file);
  const declaredMimeType = normalizeClientMimeType(file.type);
  const mimeType =
    declaredMimeType === "application/octet-stream"
      ? await detectReviewImageMimeType(file)
      : declaredMimeType;
  const processingFile = withMimeType(file, mimeType);

  let optimized: Blob;
  try {
    optimized = await (options.optimizeImage ?? optimizeReviewImageWithCanvas)(
      processingFile,
    );
  } catch {
    throw new ClientReviewImageError(
      "사진을 자동으로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  const optimizedMimeType =
    optimized.type.trim().toLowerCase() as DeclaredReviewImageMime;

  if (
    optimized.size <= 0 ||
    optimized.size > MAX_REVIEW_IMAGE_UPLOAD_BYTES ||
    !NORMALIZED_OUTPUT_IMAGE_TYPES.has(optimizedMimeType)
  ) {
    throw new ClientReviewImageError(
      "사진을 자동으로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }

  return { blob: optimized, mimeType: optimizedMimeType, optimized: true };
}
