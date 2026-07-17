import { prisma } from "@humanfirst/db";

// 20 collisions on one title is not a real-world case for a POC.
const MAX_SLUG_SUFFIX = 20;

export function slugifyTitle(title: string, maxLength = 80): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength);
}

export async function generateUniqueArticleSlug(authorId: string, title: string): Promise<string> {
  const base = slugifyTitle(title);
  const candidates = [base, ...Array.from({ length: MAX_SLUG_SUFFIX - 1 }, (_, i) => `${base}-${i + 2}`)];

  for (const candidate of candidates) {
    const existing = await prisma.article.findUnique({
      where: { authorId_slug: { authorId, slug: candidate } },
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("SLUG_EXHAUSTED");
}
