import {
  MAX_REVIEW_IMAGE_EDGE,
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
  MAX_REVIEW_IMAGE_UPLOAD_BYTES,
} from "./constants";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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
  width: number;
  height: number;
};

type LoadedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

export function validateReviewImageFile(file: Pick<File, "size" | "type">) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new ClientReviewImageError("JPEG, PNG, WebP 사진만 올릴 수 있어요.");
  }

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

export async function prepareReviewImageForUpload(
  file: File,
): Promise<PreparedClientReviewImage> {
  validateReviewImageFile(file);
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

        if (blob.size <= MAX_REVIEW_IMAGE_UPLOAD_BYTES) {
          return { blob, ...dimensions };
        }
      }
    }

    throw new ClientReviewImageError(
      "사진 용량을 충분히 줄이지 못했습니다. 다른 사진을 선택해 주세요.",
    );
  } finally {
    loaded.dispose();
  }
}
