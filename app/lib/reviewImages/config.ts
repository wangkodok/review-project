import "server-only";

export type ReviewImageStorageConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  tempBucketName: string;
  publicBucketName: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function validateBucketName(name: string, value: string) {
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value)) {
    throw new Error(`${name} has an invalid format`);
  }

  return value;
}

export function isReviewImageUploadEnabled() {
  return process.env.REVIEW_IMAGE_UPLOAD_ENABLED === "true";
}

export function getReviewImageStorageConfig(): ReviewImageStorageConfig {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const endpointValue = requireEnv("R2_ENDPOINT");
  let endpoint: URL;

  try {
    endpoint = new URL(endpointValue);
  } catch {
    throw new Error("R2_ENDPOINT has an invalid format");
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== `${accountId}.r2.cloudflarestorage.com` ||
    (endpoint.pathname !== "/" && endpoint.pathname !== "") ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.username ||
    endpoint.password
  ) {
    throw new Error("R2_ENDPOINT does not match R2_ACCOUNT_ID");
  }

  return {
    endpoint: endpoint.origin,
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    tempBucketName: validateBucketName(
      "R2_TEMP_BUCKET_NAME",
      requireEnv("R2_TEMP_BUCKET_NAME"),
    ),
    publicBucketName: validateBucketName(
      "R2_PUBLIC_BUCKET_NAME",
      requireEnv("R2_PUBLIC_BUCKET_NAME"),
    ),
  };
}
