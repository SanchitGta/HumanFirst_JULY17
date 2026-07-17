import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@humanfirst/db";
import { hashPassword } from "@/lib/passwords";
import { isValidHandle } from "@/lib/handles";
import { createDatabaseSession } from "@/lib/session";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  handle: z.string(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, name, handle } = parsed.data;

  if (!isValidHandle(handle)) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: { handle: "invalid" } }, { status: 400 });
  }

  const [existingEmail, existingHandle] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { handle } }),
  ]);

  if (existingEmail) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }
  if (existingHandle) {
    return NextResponse.json({ error: "HANDLE_TAKEN" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, handle, passwordHash },
  });

  const cookie = await createDatabaseSession(user.id);

  const response = NextResponse.json(
    { id: user.id, email: user.email, handle: user.handle },
    { status: 201 },
  );
  response.cookies.set(cookie.cookieName, cookie.value, cookie.options);
  return response;
}
