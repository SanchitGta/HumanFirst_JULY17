import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@humanfirst/db";

// Single source of truth for session/cookie behavior. Email+password bypasses
// Auth.js's provider system (see lib/session.ts) but reads its cookie contract
// from this same resolved config, so there is exactly one place that owns it.
export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" as const },
  providers: [
    Google({
      // Google verifies email ownership before issuing an id token, so linking
      // on email match here can't be used to hijack an unverified address.
      allowDangerousEmailAccountLinking: true,
    }),
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async session({ session, user }: { session: any; user: any }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.handle = user.handle;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
