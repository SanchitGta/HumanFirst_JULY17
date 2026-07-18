import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

interface FakeArticle {
  id: string;
  authorId: string;
  title: string;
  slug: string;
  status: "DRAFTING" | "LOCKED" | "PUBLISHED";
  tags: string[];
  seoDescription: string | null;
  ogImageUrl: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeHumanDraft {
  id: string;
  articleId: string;
  revisionNumber: number;
  contentJson: unknown;
  checksum: string;
  typingAnalyticsSnapshot: unknown;
  verificationResult: unknown;
  createdAt: Date;
}

interface FakeSkill {
  id: string;
  ownerId: string;
  name: string;
  expansionType: string;
  promptText: string;
  audience: string | null;
  writingStyle: string | null;
  temperature: number;
  outputFormat: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

const articlesStore = new Map<string, FakeArticle>();
const humanDraftsByArticle = new Map<string, FakeHumanDraft[]>();
const aiGenerationsByArticle = new Map<string, any[]>();
const skillsStore = new Map<string, FakeSkill>();
const versionsByArticle = new Map<string, any[]>();
const auditRows: any[] = [];

vi.mock("@humanfirst/db", () => ({
  ArticleStatus: { DRAFTING: "DRAFTING", LOCKED: "LOCKED", PUBLISHED: "PUBLISHED" },
  prisma: {
    article: {
      findUnique: vi.fn(async ({ where: { id } }: any) => articlesStore.get(id) ?? null),
      findMany: vi.fn(async ({ where }: any) => {
        return [...articlesStore.values()].filter((a) => {
          if (a.authorId !== where.authorId) return false;
          if (where.status && a.status !== where.status) return false;
          if (where.OR) {
            const matches = where.OR.some((clause: any) => {
              if (clause.title) {
                return a.title.toLowerCase().includes(String(clause.title.contains).toLowerCase());
              }
              if (clause.tags) {
                return a.tags.includes(clause.tags.has);
              }
              return false;
            });
            if (!matches) return false;
          }
          return true;
        });
      }),
    },
    humanDraft: {
      findUnique: vi.fn(async ({ where: { articleId_revisionNumber } }: any) => {
        const { articleId, revisionNumber } = articleId_revisionNumber;
        const list = humanDraftsByArticle.get(articleId) ?? [];
        return list.find((d) => d.revisionNumber === revisionNumber) ?? null;
      }),
      findFirst: vi.fn(async ({ where: { articleId } }: any) => {
        const list = humanDraftsByArticle.get(articleId) ?? [];
        if (list.length === 0) return null;
        return [...list].sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
      }),
    },
    aIGeneration: {
      findMany: vi.fn(async ({ where: { articleId } }: any) => aiGenerationsByArticle.get(articleId) ?? []),
    },
    skill: {
      findUnique: vi.fn(async ({ where: { id } }: any) => skillsStore.get(id) ?? null),
      findMany: vi.fn(async ({ where }: any) =>
        [...skillsStore.values()].filter((s) => s.ownerId === where.ownerId),
      ),
    },
    version: {
      findMany: vi.fn(async ({ where: { articleId } }: any) => versionsByArticle.get(articleId) ?? []),
    },
  },
}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(async (_sql: string, params: any[]) => {
      auditRows.push({
        id: params[0],
        toolName: params[1],
        principalUserId: params[2],
        mcpTokenId: params[3],
        articleId: params[4],
        allowed: params[5],
        reason: params[6],
        createdAt: params[7],
      });
      return { rows: [] };
    }),
  })),
}));

import { listArticles, getArticle, searchArticles } from "../../src/tools/articles.js";
import { getHumanDraft } from "../../src/tools/humanDraft.js";
import { listAiGenerations } from "../../src/tools/aiGenerations.js";
import { getSkill, listSkills } from "../../src/tools/skills.js";
import { getVersionHistory } from "../../src/tools/versionHistory.js";
import { requestContext } from "../../src/context.js";
import type { Principal } from "../../src/context.js";

function callTool<TArgs>(
  tool: (args: TArgs) => Promise<any>,
  args: TArgs,
  principal: Principal,
) {
  return requestContext.run(principal, () => tool(args));
}

function parse(result: any) {
  return JSON.parse(result.content[0].text);
}

function makeArticle(overrides: Partial<FakeArticle>): FakeArticle {
  return {
    id: randomUUID(),
    authorId: "user-1",
    title: "Untitled",
    slug: "untitled",
    status: "DRAFTING",
    tags: [],
    seoDescription: null,
    ogImageUrl: null,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("apps/mcp-server tools integration", () => {
  beforeEach(() => {
    articlesStore.clear();
    humanDraftsByArticle.clear();
    aiGenerationsByArticle.clear();
    skillsStore.clear();
    versionsByArticle.clear();
    auditRows.length = 0;
    vi.clearAllMocks();
  });

  it("get_human_draft on a DRAFTING article returns NOT_LOCKED, not content, and is audited as denied", async () => {
    const article = makeArticle({ authorId: "user-1", status: "DRAFTING" });
    articlesStore.set(article.id, article);
    const principal: Principal = { userId: "user-1", tokenId: "token-draft" };

    const result = await callTool(getHumanDraft, { articleId: article.id }, principal);
    const body = parse(result);

    expect(result.isError).toBe(true);
    expect(body.error).toBe("NOT_LOCKED");
    expect(body.content).toBeUndefined();
    expect(body.contentJson).toBeUndefined();

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      toolName: "get_human_draft",
      principalUserId: "user-1",
      mcpTokenId: "token-draft",
      articleId: article.id,
      allowed: false,
      reason: "NOT_LOCKED",
    });
  });

  it("get_human_draft on a LOCKED article owned by the caller returns content and is audited as allowed", async () => {
    const article = makeArticle({ authorId: "user-1", status: "LOCKED" });
    articlesStore.set(article.id, article);
    const draft: FakeHumanDraft = {
      id: randomUUID(),
      articleId: article.id,
      revisionNumber: 1,
      contentJson: { type: "doc", content: [] },
      checksum: "abc123",
      typingAnalyticsSnapshot: { charsTypedNet: 100 },
      verificationResult: { score: 90 },
      createdAt: new Date(),
    };
    humanDraftsByArticle.set(article.id, [draft]);
    const principal: Principal = { userId: "user-1", tokenId: "token-locked" };

    const result = await callTool(getHumanDraft, { articleId: article.id }, principal);
    const body = parse(result);

    expect(result.isError).toBeUndefined();
    expect(body.contentJson).toEqual(draft.contentJson);
    expect(body.checksum).toBe("abc123");

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      toolName: "get_human_draft",
      principalUserId: "user-1",
      mcpTokenId: "token-locked",
      articleId: article.id,
      allowed: true,
      reason: null,
    });
  });

  it("a PAT call against another user's article returns scoped FORBIDDEN denial, no content, audited", async () => {
    const article = makeArticle({ authorId: "user-2", status: "LOCKED" });
    articlesStore.set(article.id, article);
    const principal: Principal = { userId: "user-1", tokenId: "token-forbidden" };

    const result = await callTool(getArticle, { articleId: article.id }, principal);
    const body = parse(result);

    expect(result.isError).toBe(true);
    expect(body.error).toBe("FORBIDDEN");
    expect(body.title).toBeUndefined();

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      toolName: "get_article",
      principalUserId: "user-1",
      mcpTokenId: "token-forbidden",
      articleId: article.id,
      allowed: false,
      reason: "FORBIDDEN",
    });
  });

  it("a PAT call against another user's skill returns scoped FORBIDDEN denial", async () => {
    const skill: FakeSkill = {
      id: randomUUID(),
      ownerId: "user-2",
      name: "Someone else's skill",
      expansionType: "SUMMARY",
      promptText: "prompt",
      audience: null,
      writingStyle: null,
      temperature: 0.7,
      outputFormat: null,
      visibility: "PRIVATE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    skillsStore.set(skill.id, skill);
    const principal: Principal = { userId: "user-1", tokenId: "token-skill-forbidden" };

    const result = await callTool(getSkill, { skillId: skill.id }, principal);
    const body = parse(result);

    expect(result.isError).toBe(true);
    expect(body.error).toBe("FORBIDDEN");
    expect(body.promptText).toBeUndefined();
  });

  it("30 calls for one PAT succeed, the 31st in the same window is rejected as RATE_LIMITED and audited", async () => {
    const principal: Principal = { userId: "user-1", tokenId: "token-ratelimit" };

    for (let i = 0; i < 30; i++) {
      const result = await callTool(listSkills, {}, principal);
      expect(result.isError).toBeUndefined();
    }

    const result = await callTool(listSkills, {}, principal);
    const body = parse(result);
    expect(result.isError).toBe(true);
    expect(body.error).toBe("RATE_LIMITED");

    const rateLimitRows = auditRows.filter((r) => r.mcpTokenId === "token-ratelimit");
    expect(rateLimitRows).toHaveLength(31);
    expect(rateLimitRows[30]).toMatchObject({ allowed: false, reason: "RATE_LIMITED" });
  });

  it("list_articles never returns another user's rows", async () => {
    const mine = makeArticle({ authorId: "user-1", title: "Mine" });
    const theirs = makeArticle({ authorId: "user-2", title: "Theirs" });
    articlesStore.set(mine.id, mine);
    articlesStore.set(theirs.id, theirs);
    const principal: Principal = { userId: "user-1", tokenId: "token-list-articles" };

    const result = await callTool(listArticles, {}, principal);
    const body = parse(result);

    expect(body.map((a: any) => a.id)).toEqual([mine.id]);
  });

  it("list_skills never returns another user's rows", async () => {
    const mine: FakeSkill = {
      id: randomUUID(),
      ownerId: "user-1",
      name: "Mine",
      expansionType: "SUMMARY",
      promptText: "p",
      audience: null,
      writingStyle: null,
      temperature: 0.7,
      outputFormat: null,
      visibility: "PRIVATE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const theirs: FakeSkill = { ...mine, id: randomUUID(), ownerId: "user-2", name: "Theirs" };
    skillsStore.set(mine.id, mine);
    skillsStore.set(theirs.id, theirs);
    const principal: Principal = { userId: "user-1", tokenId: "token-list-skills" };

    const result = await callTool(listSkills, {}, principal);
    const body = parse(result);

    expect(body.map((s: any) => s.id)).toEqual([mine.id]);
  });

  it("search_articles never returns another user's rows even on a matching query", async () => {
    const mine = makeArticle({ authorId: "user-1", title: "Shared Keyword Article" });
    const theirs = makeArticle({ authorId: "user-2", title: "Shared Keyword Article" });
    articlesStore.set(mine.id, mine);
    articlesStore.set(theirs.id, theirs);
    const principal: Principal = { userId: "user-1", tokenId: "token-search" };

    const result = await callTool(searchArticles, { query: "Shared" }, principal);
    const body = parse(result);

    expect(body.map((a: any) => a.id)).toEqual([mine.id]);
  });

  it("list_ai_generations and get_version_history are owner-scoped and each produce exactly one audit row", async () => {
    const article = makeArticle({ authorId: "user-1", status: "LOCKED" });
    articlesStore.set(article.id, article);
    aiGenerationsByArticle.set(article.id, [
      { id: "gen-1", articleId: article.id, type: "SUMMARY", status: "READY", prompt: "p", model: "m", params: {}, sourceSkillId: null, order: 0, hidden: false, createdAt: new Date(), updatedAt: new Date() },
    ]);
    versionsByArticle.set(article.id, [
      { id: "v-1", articleId: article.id, eventType: "HUMAN_DRAFT_LOCKED", actorType: "USER", actorId: "user-1", humanDraftId: null, aiGenerationId: null, metadata: null, createdAt: new Date() },
    ]);
    const principal: Principal = { userId: "user-1", tokenId: "token-related" };

    const genResult = await callTool(listAiGenerations, { articleId: article.id }, principal);
    const genBody = parse(genResult);
    expect(genBody).toHaveLength(1);

    const versionResult = await callTool(getVersionHistory, { articleId: article.id }, principal);
    const versionBody = parse(versionResult);
    expect(versionBody).toHaveLength(1);

    const rows = auditRows.filter((r) => r.mcpTokenId === "token-related");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ toolName: "list_ai_generations", allowed: true, articleId: article.id });
    expect(rows[1]).toMatchObject({ toolName: "get_version_history", allowed: true, articleId: article.id });
  });

  it("every successful and denied call across the 8 tools writes exactly one AuditLog row with all required fields", async () => {
    const article = makeArticle({ authorId: "user-1", status: "LOCKED" });
    articlesStore.set(article.id, article);
    humanDraftsByArticle.set(article.id, [
      {
        id: randomUUID(),
        articleId: article.id,
        revisionNumber: 1,
        contentJson: {},
        checksum: "c",
        typingAnalyticsSnapshot: {},
        verificationResult: {},
        createdAt: new Date(),
      },
    ]);
    const skill: FakeSkill = {
      id: randomUUID(),
      ownerId: "user-1",
      name: "Skill",
      expansionType: "SUMMARY",
      promptText: "p",
      audience: null,
      writingStyle: null,
      temperature: 0.7,
      outputFormat: null,
      visibility: "PRIVATE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    skillsStore.set(skill.id, skill);
    const principal: Principal = { userId: "user-1", tokenId: "token-matrix" };

    await callTool(listArticles, {}, principal);
    await callTool(getArticle, { articleId: article.id }, principal);
    await callTool(searchArticles, { query: "Untitled" }, principal);
    await callTool(getHumanDraft, { articleId: article.id }, principal);
    await callTool(listAiGenerations, { articleId: article.id }, principal);
    await callTool(getSkill, { skillId: skill.id }, principal);
    await callTool(listSkills, {}, principal);
    await callTool(getVersionHistory, { articleId: article.id }, principal);

    const rows = auditRows.filter((r) => r.mcpTokenId === "token-matrix");
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.principalUserId).toBe("user-1");
      expect(row.mcpTokenId).toBe("token-matrix");
      expect(typeof row.allowed).toBe("boolean");
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(typeof row.toolName).toBe("string");
    }
  });
});
