import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RateLimitPolicy = "auth" | "like" | "posts" | "search";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isConfigured = Boolean(redisUrl && redisToken);
const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

const redis = isConfigured
  ? new Redis({
      token: redisToken!,
      url: redisUrl!,
    })
  : null;

function createLimiter(policy: RateLimitPolicy, requests: number, window: "1 m" | "10 m") {
  if (!redis) {
    return null;
  }

  return new Ratelimit({
    analytics: false,
    ephemeralCache: new Map<string, number>(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `food-review:${environment}:${policy}`,
    redis,
    timeout: 2_000,
  });
}

const limiters: Record<RateLimitPolicy, Ratelimit | null> = {
  auth: createLimiter("auth", 10, "10 m"),
  like: createLimiter("like", 20, "1 m"),
  posts: createLimiter("posts", 60, "1 m"),
  search: createLimiter("search", 30, "1 m"),
};

function firstForwardedAddress(value: string | null) {
  return value?.split(",")[0]?.trim().slice(0, 128) || null;
}

export function getRequestIp(request: Request) {
  return (
    firstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ??
    firstForwardedAddress(request.headers.get("x-real-ip")) ??
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ??
    "unknown"
  );
}

function unavailableResponse() {
  return NextResponse.json(
    {
      success: false,
      data: null,
      message: "요청 보호 서비스를 일시적으로 사용할 수 없습니다.",
      code: "RATE_LIMIT_UNAVAILABLE",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function enforceRateLimit({
  identifier,
  policy,
}: {
  identifier: string;
  policy: RateLimitPolicy;
}) {
  const limiter = limiters[policy];

  if (!limiter) {
    return process.env.NODE_ENV === "production" ? unavailableResponse() : null;
  }

  try {
    const result = await limiter.limit(identifier);

    if (result.reason === "timeout") {
      return unavailableResponse();
    }

    if (result.success) {
      return null;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000));

    return NextResponse.json(
      {
        success: false,
        data: null,
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.reset),
        },
      },
    );
  } catch {
    return process.env.NODE_ENV === "production" ? unavailableResponse() : null;
  }
}
