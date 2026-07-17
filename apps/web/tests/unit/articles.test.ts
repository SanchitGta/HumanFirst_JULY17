import { describe, expect, it, vi, beforeEach } from "vitest";

const articles = new Map<string, { authorId: string; slug: string }>();

vi.mock("@humanfirst/db", () => ({
  prisma: {
    article: {
      findUnique: vi.fn(async ({ where: { authorId_slug } }: any) => {
        for (const article of articles.values()) {
          if (article.authorId === authorId_slug.authorId && article.slug === authorId_slug.slug) {
            return article;
          }
        }
        return null;
      }),
    },
  },
}));

import { slugifyTitle, generateUniqueArticleSlug } from "@/lib/articles";

describe("slugifyTitle", () => {
  it("lowercases and hyphenates a normal title", () => {
    expect(slugifyTitle("My First Article")).toBe("my-first-article");
  });

  it("collapses runs of non [a-z0-9-] characters into a single hyphen", () => {
    expect(slugifyTitle("Hello, World!!  Foo_Bar")).toBe("hello-world-foo-bar");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugifyTitle("  --Weird Title--  ")).toBe("weird-title");
  });

  it("truncates to maxLength", () => {
    const title = "a".repeat(100);
    expect(slugifyTitle(title, 10)).toBe("a".repeat(10));
  });

  it("truncates to the default 80-char maxLength", () => {
    const title = "word ".repeat(40); // way over 80 chars once slugified
    expect(slugifyTitle(title).length).toBeLessThanOrEqual(80);
  });
});

describe("generateUniqueArticleSlug", () => {
  beforeEach(() => {
    articles.clear();
    vi.clearAllMocks();
  });

  it("returns the base slug when it is not taken", async () => {
    const slug = await generateUniqueArticleSlug("author-1", "My Title");
    expect(slug).toBe("my-title");
  });

  it("appends -2 when the base slug is already taken by the same author", async () => {
    articles.set("existing", { authorId: "author-1", slug: "my-title" });
    const slug = await generateUniqueArticleSlug("author-1", "My Title");
    expect(slug).toBe("my-title-2");
  });

  it("does not collide across different authors — same title/slug is fine for a different author", async () => {
    articles.set("existing", { authorId: "author-2", slug: "my-title" });
    const slug = await generateUniqueArticleSlug("author-1", "My Title");
    expect(slug).toBe("my-title");
  });

  it("walks numeric suffixes until it finds a free slug", async () => {
    articles.set("a", { authorId: "author-1", slug: "my-title" });
    articles.set("b", { authorId: "author-1", slug: "my-title-2" });
    articles.set("c", { authorId: "author-1", slug: "my-title-3" });
    const slug = await generateUniqueArticleSlug("author-1", "My Title");
    expect(slug).toBe("my-title-4");
  });

  it("throws SLUG_EXHAUSTED after 20 collisions", async () => {
    articles.set("base", { authorId: "author-1", slug: "my-title" });
    for (let suffix = 2; suffix <= 20; suffix++) {
      articles.set(`s${suffix}`, { authorId: "author-1", slug: `my-title-${suffix}` });
    }
    await expect(generateUniqueArticleSlug("author-1", "My Title")).rejects.toThrow("SLUG_EXHAUSTED");
  });
});
