// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
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
            "openid email profile https://www.googleapis.com/auth/calendar.events",
        },
      },
    }),
  ],
  callbacks: {
    async signIn(params) {
      console.log(
        "[NextAuth] signIn callback params",
        JSON.stringify(params, null, 2)
      );
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
      console.log("[NextAuth] events.signIn", message);
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