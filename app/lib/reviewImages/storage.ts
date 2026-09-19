import "server-only";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getReviewImageStorageConfig } from "./config";

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

let storageContext:
  | {
      client: S3Client;
      config: ReturnType<typeof getReviewImageStorageConfig>;
    }
  | undefined;

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
