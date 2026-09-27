import {
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
  MAX_REVIEW_IMAGE_UPLOAD_BYTES,
} from "./constants";
import type { DeclaredReviewImageMime } from "./uploadContract";

const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_IMAGE_TYPES = new Set([
  ...OPTIMIZABLE_IMAGE_TYPES,
  "image/heic",
  "image/heif",
  "application/octet-stream",
]);
const OUTPUT_QUALITIES = [0.86, 0.78, 0.7, 0.62, 0.54];
const OUTPUT_EDGE_SCALES = [1, 0.9, 0.8, 0.7, 0.6];

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

  if (file.size > MAX_REVIEW_IMAGE_ORIGINAL_BYTES) {
    throw new ClientReviewImageError("10MB 이하의 사진을 선택해 주세요.");
  }
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

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new ClientReviewImageError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요."));
        return;
      }

      resolve(blob);
    }, "image/webp", quality);
  });
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
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
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
        const blob = await canvasToWebp(canvas, quality);

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
  const mimeType = normalizeClientMimeType(file.type);

  if (!OPTIMIZABLE_IMAGE_TYPES.has(mimeType)) {
    return { blob: file, mimeType, optimized: false };
  }

  try {
    const optimized = await (options.optimizeImage ?? optimizeReviewImageWithCanvas)(file);

    if (
      optimized.size > 0 &&
      optimized.size < file.size &&
      optimized.type.toLowerCase() === "image/webp"
    ) {
      return { blob: optimized, mimeType: "image/webp", optimized: true };
    }
  } catch {
    // Browser image decoders vary by device. The server remains the final validator.
  }

  return { blob: file, mimeType, optimized: false };
}
