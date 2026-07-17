import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

interface FakeArticle {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  status: "DRAFTING" | "LOCKED" | "PUBLISHED";
  createdAt: Date;
  updatedAt: Date;
}

interface FakeDraftRevision {
  id: string;
  articleId: string;
  contentJson: unknown;
  charsTypedNet: number;
  charsTypedGross: number;
  backspaceCount: number;
  pasteViolationCount: number;
  activeTypingMs: number;
  sessionCount: number;
  keystrokeIntervalCount: number;
  keystrokeIntervalMeanMs: number;
  keystrokeIntervalM2: number;
}

const articles = new Map<string, FakeArticle>();
const draftRevisions = new Map<string, FakeDraftRevision>(); // keyed by articleId
let currentSessionUserId: string | null = "user-1";

vi.mock("@humanfirst/db", () => ({
  prisma: {
    article: {
      create: vi.fn(async ({ data }: any) => {
        const { draftRevision, ...articleData } = data;
        const id = randomUUID();
        const article: FakeArticle = {
          id,
          status: "DRAFTING",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...articleData,
        };
        articles.set(id, article);
        if (draftRevision?.create) {
          draftRevisions.set(id, {
            id: randomUUID(),
            articleId: id,
            contentJson: draftRevision.create.contentJson,
            charsTypedNet: 0,
            charsTypedGross: 0,
            backspaceCount: 0,
            pasteViolationCount: 0,
            activeTypingMs: 0,
            sessionCount: 0,
            keystrokeIntervalCount: 0,
            keystrokeIntervalMeanMs: 0,
            keystrokeIntervalM2: 0,
          });
        }
        return article;
      }),
      findUnique: vi.fn(async ({ where, include }: any) => {
        if (where.id) {
          const article = articles.get(where.id);
          if (!article) return null;
          if (include?.draftRevision) {
            return { ...article, draftRevision: draftRevisions.get(where.id) ?? null };
          }
          return article;
        }
        if (where.authorId_slug) {
          for (const article of articles.values()) {
            if (
              article.authorId === where.authorId_slug.authorId &&
              article.slug === where.authorId_slug.slug
            ) {
              return article;
            }
          }
          return null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return [...articles.values()].filter((a) => a.authorId === where.authorId);
      }),
    },
    draftRevision: {
      findUnique: vi.fn(async ({ where: { articleId } }: any) => draftRevisions.get(articleId) ?? null),
      update: vi.fn(async ({ where: { articleId }, data }: any) => {
        const existing = draftRevisions.get(articleId)!;
        const updated: any = { ...existing };
        for (const key of Object.keys(data)) {
          const value = data[key];
          if (value && typeof value === "object" && "increment" in value) {
            updated[key] = (existing as any)[key] + value.increment;
          } else if (value !== undefined) {
            updated[key] = value;
          }
        }
        draftRevisions.set(articleId, updated);
        return updated;
      }),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null)),
}));

import { POST as createArticle } from "@/app/api/articles/route";
import { POST as postDraft } from "@/app/api/articles/[id]/draft/route";
import { POST as checkScore } from "@/app/api/articles/[id]/check-score/route";
import { computeHumanConfidenceScore, getHcsConfig } from "@humanfirst/verification";

function req(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost"), init);
}

function draftDeltaBody(overrides: Partial<Record<string, unknown>> = {}, delta: Record<string, unknown> = {}) {
  return {
    contentJson: { type: "doc", content: [] },
    delta: {
      charsTypedNet: 0,
      charsTypedGross: 0,
      backspaceCount: 0,
      pasteViolationCount: 0,
      activeTypingMs: 0,
      intervalCount: 0,
      intervalSum: 0,
      intervalSumSq: 0,
      isNewSession: false,
      ...delta,
    },
    ...overrides,
  };
}

async function createTestArticle(title = "Test Article") {
  const response = await createArticle(
    req("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }),
  );
  return response.json();
}

function naiveMeanAndM2(samples: number[]): { meanMs: number; m2: number } {
  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  const m2 = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0);
  return { meanMs: mean, m2 };
}

describe("articles integration", () => {
  beforeEach(() => {
    articles.clear();
    draftRevisions.clear();
    currentSessionUserId = "user-1";
    vi.clearAllMocks();
  });

  it("POST /api/articles creates an Article and a nested DraftRevision in one call", async () => {
    const created = await createTestArticle("My First Article");
    expect(created.id).toBeTruthy();
    expect(created.slug).toBe("my-first-article");

    const draft = draftRevisions.get(created.id);
    expect(draft).toBeDefined();
    expect(draft?.contentJson).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("requires authentication to create an article", async () => {
    currentSessionUserId = null;
    const response = await createArticle(
      req("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "No auth" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("applies draft delta increments across two sequential batches, merging cadence stats correctly", async () => {
    const created = await createTestArticle();

    const batch1Samples = [150, 200, 250, 180, 220];
    const batch2Samples = [190, 210, 205, 195, 200, 208];

    const batch1 = {
      count: batch1Samples.length,
      sum: batch1Samples.reduce((a, b) => a + b, 0),
      sumSq: batch1Samples.reduce((a, b) => a + b * b, 0),
    };
    const batch2 = {
      count: batch2Samples.length,
      sum: batch2Samples.reduce((a, b) => a + b, 0),
      sumSq: batch2Samples.reduce((a, b) => a + b * b, 0),
    };

    const firstResponse = await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draftDeltaBody(
            {},
            {
              charsTypedNet: 50,
              charsTypedGross: 55,
              backspaceCount: 5,
              activeTypingMs: batch1.sum,
              intervalCount: batch1.count,
              intervalSum: batch1.sum,
              intervalSumSq: batch1.sumSq,
              isNewSession: true,
            },
          ),
        ),
      }),
      { params: { id: created.id } },
    );
    expect(firstResponse.status).toBe(200);

    const secondResponse = await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draftDeltaBody(
            {},
            {
              charsTypedNet: 30,
              charsTypedGross: 32,
              backspaceCount: 2,
              activeTypingMs: batch2.sum,
              intervalCount: batch2.count,
              intervalSum: batch2.sum,
              intervalSumSq: batch2.sumSq,
              isNewSession: false,
            },
          ),
        ),
      }),
      { params: { id: created.id } },
    );
    expect(secondResponse.status).toBe(200);

    const draft = draftRevisions.get(created.id)!;
    expect(draft.charsTypedNet).toBe(80);
    expect(draft.charsTypedGross).toBe(87);
    expect(draft.backspaceCount).toBe(7);
    expect(draft.activeTypingMs).toBe(batch1.sum + batch2.sum);
    expect(draft.sessionCount).toBe(1); // only batch1's isNewSession counted

    const naive = naiveMeanAndM2([...batch1Samples, ...batch2Samples]);
    expect(draft.keystrokeIntervalCount).toBe(batch1.count + batch2.count);
    expect(draft.keystrokeIntervalMeanMs).toBeCloseTo(naive.meanMs, 6);
    expect(draft.keystrokeIntervalM2).toBeCloseTo(naive.m2, 6);
  });

  it("returns 403 when a non-owner posts a draft delta (ownership guard)", async () => {
    currentSessionUserId = "user-1";
    const created = await createTestArticle();

    currentSessionUserId = "user-2";
    const response = await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftDeltaBody()),
      }),
      { params: { id: created.id } },
    );
    expect(response.status).toBe(403);
  });

  it("returns 409 NOT_DRAFTING when the article is no longer in DRAFTING status", async () => {
    const created = await createTestArticle();
    articles.set(created.id, { ...articles.get(created.id)!, status: "LOCKED" });

    const draftResponse = await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftDeltaBody()),
      }),
      { params: { id: created.id } },
    );
    expect(draftResponse.status).toBe(409);
    expect((await draftResponse.json()).error).toBe("NOT_DRAFTING");

    const scoreResponse = await checkScore(req(`/api/articles/${created.id}/check-score`, { method: "POST" }), {
      params: { id: created.id },
    });
    expect(scoreResponse.status).toBe(409);
  });

  it("only increments sessionCount when isNewSession is true", async () => {
    const created = await createTestArticle();

    await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftDeltaBody({}, { isNewSession: false })),
      }),
      { params: { id: created.id } },
    );
    expect(draftRevisions.get(created.id)!.sessionCount).toBe(0);

    await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftDeltaBody({}, { isNewSession: true })),
      }),
      { params: { id: created.id } },
    );
    expect(draftRevisions.get(created.id)!.sessionCount).toBe(1);

    await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftDeltaBody({}, { isNewSession: false })),
      }),
      { params: { id: created.id } },
    );
    expect(draftRevisions.get(created.id)!.sessionCount).toBe(1);
  });

  it("POST /api/articles/:id/check-score returns a score matching computeHumanConfidenceScore called directly", async () => {
    const created = await createTestArticle();

    await postDraft(
      req(`/api/articles/${created.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          draftDeltaBody(
            {},
            {
              charsTypedNet: 600,
              charsTypedGross: 620,
              backspaceCount: 20,
              pasteViolationCount: 1,
              activeTypingMs: 60000,
              intervalCount: 30,
              intervalSum: 6000,
              intervalSumSq: 1260000,
              isNewSession: true,
            },
          ),
        ),
      }),
      { params: { id: created.id } },
    );

    const response = await checkScore(req(`/api/articles/${created.id}/check-score`, { method: "POST" }), {
      params: { id: created.id },
    });
    expect(response.status).toBe(200);
    const result = await response.json();

    const draft = draftRevisions.get(created.id)!;
    const expected = computeHumanConfidenceScore(
      {
        charsTypedNet: draft.charsTypedNet,
        charsTypedGross: draft.charsTypedGross,
        backspaceCount: draft.backspaceCount,
        pasteViolationCount: draft.pasteViolationCount,
        activeTypingMs: draft.activeTypingMs,
        sessionCount: draft.sessionCount,
        keystrokeIntervalCount: draft.keystrokeIntervalCount,
        keystrokeIntervalMeanMs: draft.keystrokeIntervalMeanMs,
        keystrokeIntervalM2: draft.keystrokeIntervalM2,
      },
      getHcsConfig(),
    );

    expect(result.score).toBe(expected.score);
    expect(result.breakdown).toEqual(expected.breakdown);
  });
});
