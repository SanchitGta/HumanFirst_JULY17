import { NextResponse } from "next/server";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const token = await prisma.mCPToken.findUnique({ where: { id: params.id } });
  if (!token) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (token.userId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Soft delete: preserves AuditLog.mcpTokenId FK integrity for historical audit rows.
  await prisma.mCPToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });

  return new NextResponse(null, { status: 204 });
}
