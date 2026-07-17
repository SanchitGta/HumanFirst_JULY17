import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";
import { generateToken } from "@/lib/tokens";

const createTokenSchema = z.object({
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const { raw, hash, prefix } = generateToken();

  const token = await prisma.mCPToken.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      tokenHash: hash,
      tokenPrefix: prefix,
    },
  });

  // raw is returned here only — never persisted, logged, or echoed again.
  return NextResponse.json(
    { id: token.id, name: token.name, token: raw, tokenPrefix: token.tokenPrefix, createdAt: token.createdAt },
    { status: 201 },
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const tokens = await prisma.mCPToken.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens, { status: 200 });
}
