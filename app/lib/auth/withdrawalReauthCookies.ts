import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { WITHDRAWAL_REAUTH_TTL_SECONDS } from "./withdrawalReauth";

const FLOW_COOKIE_NAME = "food-review-withdrawal-reauth-flow";
const SECURE_FLOW_COOKIE_NAME = `__Secure-${FLOW_COOKIE_NAME}`;
const CSRF_COOKIE_NAME = "food-review-withdrawal-reauth-csrf";
const SECURE_CSRF_COOKIE_NAME = `__Secure-${CSRF_COOKIE_NAME}`;

function isSecureEnvironment() {
  return process.env.NODE_ENV === "production";
}

function currentCookieNames() {
  if (isSecureEnvironment()) {
    return {
      flow: SECURE_FLOW_COOKIE_NAME,
      csrf: SECURE_CSRF_COOKIE_NAME,
    };
  }

  return {
    flow: FLOW_COOKIE_NAME,
    csrf: CSRF_COOKIE_NAME,
  };
}

function getCookieValue(
  request: NextRequest,
  regularName: string,
  secureName: string,
) {
  return (
    request.cookies.get(secureName)?.value ??
    request.cookies.get(regularName)?.value ??
    null
  );
}

export function getWithdrawalReauthFlowCookie(request: NextRequest) {
  return getCookieValue(request, FLOW_COOKIE_NAME, SECURE_FLOW_COOKIE_NAME);
}

export function getWithdrawalReauthCsrfCookie(request: NextRequest) {
  return getCookieValue(request, CSRF_COOKIE_NAME, SECURE_CSRF_COOKIE_NAME);
}

export function setWithdrawalReauthCookies({
  response,
  flowId,
  csrfNonce,
}: {
  response: NextResponse;
  flowId: string;
  csrfNonce: string;
}) {
  const cookieNames = currentCookieNames();
  const secure = isSecureEnvironment();

  response.cookies.set({
    name: cookieNames.flow,
    value: flowId,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: WITHDRAWAL_REAUTH_TTL_SECONDS,
  });
  response.cookies.set({
    name: cookieNames.csrf,
    value: csrfNonce,
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: WITHDRAWAL_REAUTH_TTL_SECONDS,
  });
}

export function expireWithdrawalReauthCookies(response: NextResponse) {
  const cookieNames = [
    FLOW_COOKIE_NAME,
    SECURE_FLOW_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    SECURE_CSRF_COOKIE_NAME,
  ];

  for (const name of cookieNames) {
    response.cookies.set({
      name,
      value: "",
      httpOnly:
        name === FLOW_COOKIE_NAME || name === SECURE_FLOW_COOKIE_NAME,
      sameSite: name.includes("csrf") ? "strict" : "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
}
