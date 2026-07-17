import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@humanfirst/db";
import { authConfig } from "@/auth";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, Auth.js's own database-session default

export interface CookieOptions {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
}

export interface DatabaseSessionCookie {
  cookieName: string;
  value: string;
  options: CookieOptions;
}

// Kept byte-for-byte consistent with Auth.js's own cookie contract by reading the
// cookie name/options off the same resolved authConfig auth.ts uses, rather than
// restating them as a second literal source of truth.
export async function createDatabaseSession(userId: string): Promise<DatabaseSessionCookie> {
  const adapter = PrismaAdapter(prisma);
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const sessionToken = randomUUID();

  await adapter.createSession!({
    sessionToken,
    userId,
    expires,
  });

  const sessionCookie = (authConfig as any).cookies?.sessionToken;
  const cookieName: string =
    sessionCookie?.name ??
    (process.env.AUTH_URL?.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token");

  return {
    cookieName,
    value: sessionToken,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      ...sessionCookie?.options,
    },
  };
}
