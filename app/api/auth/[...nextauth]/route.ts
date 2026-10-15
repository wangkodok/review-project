import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";
import { isAuthSessionExpired } from "@/app/lib/auth/sessionPolicy";

const handler = NextAuth(authOptions);
const LEGACY_WITHDRAWAL_FLOW_COOKIE_NAMES = [
  "food-review-withdrawal-reauth-flow",
  "__Secure-food-review-withdrawal-reauth-flow",
] as const;
const LEGACY_WITHDRAWAL_COOKIE_NAMES = [
  ...LEGACY_WITHDRAWAL_FLOW_COOKIE_NAMES,
  "food-review-withdrawal-reauth-csrf",
  "__Secure-food-review-withdrawal-reauth-csrf",
] as const;

type AuthRouteContext = {
  params: Promise<{
    nextauth: string[];
  }>;
};

function isProviderCallback(request: NextRequest) {
  return (
    request.nextUrl.pathname.endsWith("/api/auth/callback/google") ||
    request.nextUrl.pathname.endsWith("/api/auth/callback/kakao")
  );
}

function expireLegacyWithdrawalCookies(response: NextResponse) {
  for (const name of LEGACY_WITHDRAWAL_COOKIE_NAMES) {
    response.cookies.set({
      name,
      value: "",
      httpOnly: name.includes("flow"),
      sameSite: name.includes("csrf") ? "strict" : "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}

function handleAuthRequest(
  request: NextRequest,
  context: AuthRouteContext,
) {
  const hasLegacyWithdrawalFlow = LEGACY_WITHDRAWAL_FLOW_COOKIE_NAMES.some(
    (name) => request.cookies.has(name),
  );

  if (isProviderCallback(request) && hasLegacyWithdrawalFlow) {
    const response = NextResponse.redirect(new URL("/my", request.url));
    expireLegacyWithdrawalCookies(response);
    return response;
  }

  return handler(request, context);
}

function withoutAuthCookieUpdates(response: Response) {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function GET(
  request: NextRequest,
  context: AuthRouteContext,
) {
  if (request.nextUrl.pathname.endsWith("/api/auth/session") && request.nextUrl.searchParams.get("readOnly") === "true") {
    return withoutAuthCookieUpdates(await handleAuthRequest(request, context));
  }
  return handleAuthRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: AuthRouteContext,
) {
  let isExpiryLogout = false;
  if (request.nextUrl.pathname.endsWith("/api/auth/signout")) {
    const body = new URLSearchParams(await request.clone().text());
    if (body.get("expireOnly") === "true") {
      isExpiryLogout = true;
      const token = await getToken({ req: request, secret: authOptions.secret, decode: authOptions.jwt?.decode });
      // Only expiry logout is conditional; ordinary user-requested logout is unchanged.
      if (token && !token.authSessionExpired && !isAuthSessionExpired(token.authenticatedAt)) {
        return NextResponse.json({ success: false, code: "AUTH_SESSION_CHANGED" }, { status: 409 });
      }
    }
  }
  if (request.nextUrl.pathname.includes("/api/auth/signin")) {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "auth",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  // Automatic expiry must not overwrite an OAuth cookie arriving in another tab.
  // Authorization is already denied by the absolute server deadline.
  return isExpiryLogout
    ? withoutAuthCookieUpdates(await handleAuthRequest(request, context))
    : handleAuthRequest(request, context);
}
