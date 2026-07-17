import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@humanfirst/db";
import { verifyPassword } from "@/lib/passwords";
import { createDatabaseSession } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Identical error for "no such user" and "wrong password" to avoid user enumeration.
const INVALID_CREDENTIALS_RESPONSE = { error: "INVALID_CREDENTIALS" } as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    return NextResponse.json(INVALID_CREDENTIALS_RESPONSE, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(INVALID_CREDENTIALS_RESPONSE, { status: 401 });
  }

  const cookie = await createDatabaseSession(user.id);

  const response = NextResponse.json({ id: user.id, email: user.email, handle: user.handle }, { status: 200 });
  response.cookies.set(cookie.cookieName, cookie.value, cookie.options);
  return response;
}
