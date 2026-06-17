import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findOrCreateUserByGoogle } from "./user";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

const authSecret = requireEnv("AUTH_SECRET");
const authUrl = requireEnv("AUTH_URL");

process.env.NEXTAUTH_SECRET ??= authSecret;
process.env.NEXTAUTH_URL ??= authUrl;

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: requireEnv("AUTH_GOOGLE_ID"),
      clientSecret: requireEnv("AUTH_GOOGLE_SECRET"),
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.provider === "google" && account.providerAccountId && user.email) {
        const appUser = await findOrCreateUserByGoogle({
          googleId: account.providerAccountId,
          email: user.email,
        });

        token.userId = appUser.id;
        token.nickname = appUser.nickname;
        token.anonymousId = appUser.anonymousId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.nickname = token.nickname;
        session.user.anonymousId = token.anonymousId;
      }

      return session;
    },
  },
  pages: {
    signIn: "/my",
  },
};
