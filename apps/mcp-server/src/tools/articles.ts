import { z } from "zod";
import { prisma, ArticleStatus } from "@humanfirst/db";
import type { Principal } from "../context.js";
import { ToolError } from "../toolError.js";
import { withToolGuard } from "./guard.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const articleStatusSchema = z.nativeEnum(ArticleStatus);

const ARTICLE_LIST_FIELDS = {
  id: true,
  title: true,
  slug: true,
  status: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ARTICLE_DETAIL_FIELDS = {
  id: true,
  title: true,
  slug: true,
  status: true,
  tags: true,
  seoDescription: true,
  ogImageUrl: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listArticlesShape = {
  status: articleStatusSchema.optional(),
  limit: z.number().int().positive().optional(),
};
const listArticlesSchema = z.object(listArticlesShape);

async function listArticlesHandler(
  args: z.infer<typeof listArticlesSchema>,
  principal: Principal,
) {
  const articles = await prisma.article.findMany({
    where: { authorId: principal.userId, ...(args.status && { status: args.status }) },
    orderBy: { updatedAt: "desc" },
    take: Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: ARTICLE_LIST_FIELDS,
  });
  return { data: articles, articleId: null };
}

export const listArticles = withToolGuard("list_articles", listArticlesHandler);

export const getArticleShape = {
  articleId: z.string(),
};
const getArticleSchema = z.object(getArticleShape);

async function getArticleHandler(args: z.infer<typeof getArticleSchema>, principal: Principal) {
  const article = await prisma.article.findUnique({ where: { id: args.articleId } });
  if (!article) {
    throw new ToolError("NOT_FOUND", "Article not found", args.articleId);
  }
  if (article.authorId !== principal.userId) {
    throw new ToolError("FORBIDDEN", "Article is not owned by this PAT's user", args.articleId);
  }

  const data = Object.fromEntries(
    Object.keys(ARTICLE_DETAIL_FIELDS).map((key) => [key, (article as Record<string, unknown>)[key]]),
  );
  return { data, articleId: args.articleId };
}

export const getArticle = withToolGuard("get_article", getArticleHandler);

export const searchArticlesShape = {
  query: z.string(),
  status: articleStatusSchema.optional(),
  limit: z.number().int().positive().optional(),
};
const searchArticlesSchema = z.object(searchArticlesShape);

async function searchArticlesHandler(
  args: z.infer<typeof searchArticlesSchema>,
  principal: Principal,
) {
  const articles = await prisma.article.findMany({
    where: {
      authorId: principal.userId,
      ...(args.status && { status: args.status }),
      OR: [
        { title: { contains: args.query, mode: "insensitive" } },
        { tags: { has: args.query } },
      ],
    },
    take: Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: ARTICLE_LIST_FIELDS,
  });
  return { data: articles, articleId: null };
}

export const searchArticles = withToolGuard("search_articles", searchArticlesHandler);
