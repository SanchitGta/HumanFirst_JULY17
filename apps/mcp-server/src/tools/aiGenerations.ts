import { z } from "zod";
import { prisma } from "@humanfirst/db";
import type { Principal } from "../context.js";
import { ToolError } from "../toolError.js";
import { withToolGuard } from "./guard.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export const listAiGenerationsShape = {
  articleId: z.string(),
  limit: z.number().int().positive().optional(),
};
const listAiGenerationsSchema = z.object(listAiGenerationsShape);

async function listAiGenerationsHandler(
  args: z.infer<typeof listAiGenerationsSchema>,
  principal: Principal,
) {
  const article = await prisma.article.findUnique({ where: { id: args.articleId } });
  if (!article) {
    throw new ToolError("NOT_FOUND", "Article not found", args.articleId);
  }
  if (article.authorId !== principal.userId) {
    throw new ToolError("FORBIDDEN", "Article is not owned by this PAT's user", args.articleId);
  }

  const generations = await prisma.aIGeneration.findMany({
    where: { articleId: args.articleId },
    orderBy: { order: "asc" },
    take: Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: {
      id: true,
      type: true,
      status: true,
      prompt: true,
      model: true,
      params: true,
      sourceSkillId: true,
      order: true,
      hidden: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { data: generations, articleId: args.articleId };
}

export const listAiGenerations = withToolGuard("list_ai_generations", listAiGenerationsHandler);
