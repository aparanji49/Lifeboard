// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const NEXTAUTH_URL = process.env.NEXTAUTH_URL;
const isHttps = NEXTAUTH_URL?.startsWith("https://") === true;

if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXTAUTH_SECRET) {
    console.warn(
      "[NextAuth] NEXTAUTH_SECRET is missing — set a strong secret in production."
    );
  }
  if (!isHttps) {
    console.warn(
      "[NextAuth] NEXTAUTH_URL should use https:// in production for secure cookies and OAuth."
    );
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  /** Required in production; do not rely on implicit hashing of options. */
  secret: process.env.NEXTAUTH_SECRET,
  /**
   * HTTPS sites: secure, httpOnly session cookies. Local http://localhost stays usable.
   * @see https://next-auth.js.org/configuration/options#usesecurecookies
   */
  useSecureCookies: isHttps,
  session: {
    // Prisma adapter defaults strategy to "database"
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // roll session expiry at most once per 24h of activity
  },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
  ],
  callbacks: {
    async signIn(params) {
      // console.log(
      //   "[NextAuth] signIn callback params",
      //   JSON.stringify(params, null, 2)
      // );
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        // this will type-check after you add module augmentation (step 2)
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async signIn(message) {
      // console.log("[NextAuth] events.signIn", message);
    },
  },
  logger: {
    error(code, metadata) {
      console.error("[NextAuth] logger.error", code, metadata);
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };