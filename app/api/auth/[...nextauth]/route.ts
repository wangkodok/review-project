import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  authOptions,
  authSecret,
  createAuthOptions,
} from "@/app/lib/auth/options";
import type { AuthProvider } from "@/app/lib/auth/externalIdentity";
import {
  expireWithdrawalReauthCookies,
  getWithdrawalReauthFlowCookie,
} from "@/app/lib/auth/withdrawalReauthCookies";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";

const handler = NextAuth(authOptions);

type AuthRouteContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

function getAuthCallbackProvider(request: NextRequest): AuthProvider | null {
  if (request.nextUrl.pathname.endsWith("/api/auth/callback/google")) {
    return "google";
  }

  if (request.nextUrl.pathname.endsWith("/api/auth/callback/kakao")) {
    return "kakao";
  }

  return null;
}

async function handleAuthRequest(
  request: NextRequest,
  context: AuthRouteContext,
) {
  const callbackProvider = getAuthCallbackProvider(request);

  if (!callbackProvider) {
    return handler(request, context);
  }

  const flowId = getWithdrawalReauthFlowCookie(request);

  if (!flowId) {
    return handler(request, context);
  }

  const originalToken = await getToken({
    req: request,
    secret: authSecret,
  });

  if (
    !originalToken?.userId ||
    (originalToken.authProvider !== "google" &&
      originalToken.authProvider !== "kakao") ||
    originalToken.authValidationUnavailable ||
    originalToken.authSessionInvalidated
  ) {
    const response = await handler(request, context);
    const cookieResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    expireWithdrawalReauthCookies(cookieResponse);
    return cookieResponse;
  }

  const requestAuthOptions = createAuthOptions({
    withdrawalReauth: {
      flowId,
      originalToken,
    },
  });

  return NextAuth(request, context, requestAuthOptions);
}

export async function GET(
  request: NextRequest,
  context: AuthRouteContext,
) {
  return handleAuthRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: AuthRouteContext,
) {
  if (request.nextUrl.pathname.includes("/api/auth/signin")) {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "auth",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return handleAuthRequest(request, context);
}
