import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getReviewImageStorageConfig } from "./config";
import {
  MAX_REVIEW_IMAGE_ORIGINAL_BYTES,
  REVIEW_IMAGE_UPLOAD_URL_SECONDS,
} from "./constants";
import type { DeclaredReviewImageMime } from "./uploadContract";

export type ReviewImageObjectKeys = {
  temp: string;
  detail: string;
  thumbnail: string;
};

type PutObjectInput = {
  bucket: "temp" | "public";
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
};

type ReviewImageTempUploadInput = {
  key: string;
  contentType: DeclaredReviewImageMime;
};

type DestroyableAsyncIterable = AsyncIterable<unknown> & {
  destroy?: () => void;
};

let storageContext:
  | {
      client: S3Client;
      config: ReturnType<typeof getReviewImageStorageConfig>;
    }
  | undefined;

export class ReviewImageTempObjectNotFoundError extends Error {
  constructor() {
    super("Temporary review image object was not found");
    this.name = "ReviewImageTempObjectNotFoundError";
  }
}

function isObjectNotFound(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };

  return (
    record.$metadata?.httpStatusCode === 404 ||
    record.name === "NotFound" ||
    record.name === "NoSuchKey"
  );
}

function getStorageContext() {
  if (storageContext) {
    return storageContext;
  }

  const config = getReviewImageStorageConfig();

  storageContext = {
    client: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
    config,
  };

  return storageContext;
}

function bucketName(
  bucket: PutObjectInput["bucket"],
  config: ReturnType<typeof getReviewImageStorageConfig>,
) {
  return bucket === "temp" ? config.tempBucketName : config.publicBucketName;
}

function isDestroyableAsyncIterable(
  value: unknown,
): value is DestroyableAsyncIterable {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === "function"
  );
}

function toUint8Array(value: unknown) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  throw new Error("R2 object stream returned an invalid chunk");
}

export async function createReviewImageTempUploadUrl(
  input: ReviewImageTempUploadInput,
) {
  const { client, config } = getStorageContext();
  const command = new PutObjectCommand({
    Bucket: config.tempBucketName,
    Key: input.key,
    ContentType: input.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: REVIEW_IMAGE_UPLOAD_URL_SECONDS,
  });
}

export async function headReviewImageTempObject(key: string) {
  const { client, config } = getStorageContext();
  let head: HeadObjectCommandOutput;

  try {
    head = await client.send(
      new HeadObjectCommand({
        Bucket: config.tempBucketName,
        Key: key,
      }),
    );
  } catch (error) {
    if (isObjectNotFound(error)) {
      throw new ReviewImageTempObjectNotFoundError();
    }

    throw new Error("R2 object metadata is unavailable");
  }

  if (
    typeof head.ContentLength !== "number" ||
    !Number.isInteger(head.ContentLength) ||
    head.ContentLength < 0
  ) {
    throw new Error("R2 object size is unavailable");
  }

  return {
    byteSize: head.ContentLength,
    contentType:
      typeof head.ContentType === "string" ? head.ContentType : undefined,
  };
}

export async function readReviewImageTempObject(key: string) {
  const { client, config } = getStorageContext();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.tempBucketName,
      Key: key,
    }),
  );

  if (!isDestroyableAsyncIterable(result.Body)) {
    throw new Error("R2 object body is unavailable");
  }

  const body = result.Body;
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  for await (const value of body) {
    const chunk = toUint8Array(value);

    if (byteLength + chunk.byteLength > MAX_REVIEW_IMAGE_ORIGINAL_BYTES) {
      body.destroy?.();
      throw new Error("R2 object exceeds the maximum allowed size");
    }

    byteLength += chunk.byteLength;
    chunks.push(chunk);
  }

  const output = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

export async function putReviewImageObject(input: PutObjectInput) {
  const { client, config } = getStorageContext();
  const bucket = bucketName(input.bucket, config);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl,
    }),
  );

  const head = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: input.key,
    }),
  );

  if (head.ContentLength !== input.body.byteLength) {
    throw new Error("R2 object size verification failed");
  }
}

export async function deleteReviewImageObject(
  bucket: "temp" | "public",
  key: string,
) {
  const { client, config } = getStorageContext();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName(bucket, config),
      Key: key,
    }),
  );
}

export async function deleteReviewImageObjectsBestEffort(
  keys: ReviewImageObjectKeys,
) {
  return Promise.allSettled([
    deleteReviewImageObject("temp", keys.temp),
    deleteReviewImageObject("public", keys.detail),
    deleteReviewImageObject("public", keys.thumbnail),
  ]);
}
