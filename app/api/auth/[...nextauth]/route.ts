import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/app/lib/auth/options";
import { enforceRateLimit, getRequestIp } from "@/app/lib/security/rateLimit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(request: NextRequest, context: unknown) {
  if (request.nextUrl.pathname.includes("/api/auth/signin")) {
    const rateLimitResponse = await enforceRateLimit({
      identifier: getRequestIp(request),
      policy: "auth",
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return handler(request, context);
}
