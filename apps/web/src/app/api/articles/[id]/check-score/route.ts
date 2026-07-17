import { NextResponse } from "next/server";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";
import { computeHumanConfidenceScore, getHcsConfig, type TypingAnalyticsSnapshot } from "@humanfirst/verification";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { draftRevision: true },
  });
  if (!article) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (article.status !== "DRAFTING") {
    return NextResponse.json({ error: "NOT_DRAFTING" }, { status: 409 });
  }
  if (!article.draftRevision) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const snapshot: TypingAnalyticsSnapshot = {
    charsTypedNet: article.draftRevision.charsTypedNet,
    charsTypedGross: article.draftRevision.charsTypedGross,
    backspaceCount: article.draftRevision.backspaceCount,
    pasteViolationCount: article.draftRevision.pasteViolationCount,
    activeTypingMs: article.draftRevision.activeTypingMs,
    sessionCount: article.draftRevision.sessionCount,
    keystrokeIntervalCount: article.draftRevision.keystrokeIntervalCount,
    keystrokeIntervalMeanMs: article.draftRevision.keystrokeIntervalMeanMs,
    keystrokeIntervalM2: article.draftRevision.keystrokeIntervalM2,
  };

  const result = computeHumanConfidenceScore(snapshot, getHcsConfig());

  return NextResponse.json(result, { status: 200 });
}
