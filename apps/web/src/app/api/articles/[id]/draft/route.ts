import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";
import { mergeIntervalStats } from "@/lib/typingAnalytics";

const draftDeltaSchema = z.object({
  contentJson: z.unknown(),
  delta: z.object({
    charsTypedNet: z.number().int(),
    charsTypedGross: z.number().int().min(0),
    backspaceCount: z.number().int().min(0),
    pasteViolationCount: z.number().int().min(0),
    activeTypingMs: z.number().int().min(0),
    intervalCount: z.number().int().min(0),
    intervalSum: z.number().int().min(0),
    intervalSumSq: z.number().int().min(0),
    isNewSession: z.boolean(),
  }),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const article = await prisma.article.findUnique({ where: { id: params.id } });
  if (!article) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (article.authorId !== session.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (article.status !== "DRAFTING") {
    return NextResponse.json({ error: "NOT_DRAFTING" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = draftDeltaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const { contentJson, delta } = parsed.data;

  const existing = await prisma.draftRevision.findUnique({ where: { articleId: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const merged =
    delta.intervalCount === 0
      ? { count: existing.keystrokeIntervalCount, meanMs: existing.keystrokeIntervalMeanMs, m2: existing.keystrokeIntervalM2 }
      : mergeIntervalStats(
          {
            count: existing.keystrokeIntervalCount,
            meanMs: existing.keystrokeIntervalMeanMs,
            m2: existing.keystrokeIntervalM2,
          },
          { count: delta.intervalCount, sum: delta.intervalSum, sumSq: delta.intervalSumSq },
        );

  await prisma.draftRevision.update({
    where: { articleId: params.id },
    data: {
      contentJson: contentJson as any,
      charsTypedNet: { increment: delta.charsTypedNet },
      charsTypedGross: { increment: delta.charsTypedGross },
      backspaceCount: { increment: delta.backspaceCount },
      pasteViolationCount: { increment: delta.pasteViolationCount },
      activeTypingMs: { increment: delta.activeTypingMs },
      sessionCount: delta.isNewSession ? { increment: 1 } : undefined,
      keystrokeIntervalCount: merged.count,
      keystrokeIntervalMeanMs: merged.meanMs,
      keystrokeIntervalM2: merged.m2,
    },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
