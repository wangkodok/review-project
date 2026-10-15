import "server-only";

import { decode } from "next-auth/jwt";

export async function decodeAuthSessionToken(params: Parameters<typeof decode>[0]) {
  try {
    return await decode(params);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ERR_JWT_EXPIRED") {
      // An expired, authenticated JWE must never restore identity claims.
      return { authSessionExpired: true, authSessionInvalidated: true };
    }
    throw error;
  }
}
