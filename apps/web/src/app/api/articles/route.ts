import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";
import { generateUniqueArticleSlug } from "@/lib/articles";

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
});

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createArticleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
  }

  const slug = await generateUniqueArticleSlug(session.user.id, parsed.data.title);

  const article = await prisma.article.create({
    data: {
      authorId: session.user.id,
      title: parsed.data.title,
      slug,
      draftRevision: { create: { contentJson: EMPTY_TIPTAP_DOC } },
    },
  });

  return NextResponse.json({ id: article.id, slug: article.slug }, { status: 201 });
}
