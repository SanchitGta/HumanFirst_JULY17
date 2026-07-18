import { z } from "zod";
import { prisma } from "@humanfirst/db";
import type { Principal } from "../context.js";
import { ToolError } from "../toolError.js";
import { withToolGuard } from "./guard.js";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

export const getVersionHistoryShape = {
  articleId: z.string(),
  limit: z.number().int().positive().optional(),
};
const getVersionHistorySchema = z.object(getVersionHistoryShape);

async function getVersionHistoryHandler(
  args: z.infer<typeof getVersionHistorySchema>,
  principal: Principal,
) {
  const article = await prisma.article.findUnique({ where: { id: args.articleId } });
  if (!article) {
    throw new ToolError("NOT_FOUND", "Article not found", args.articleId);
  }
  if (article.authorId !== principal.userId) {
    throw new ToolError("FORBIDDEN", "Article is not owned by this PAT's user", args.articleId);
  }

  const versions = await prisma.version.findMany({
    where: { articleId: args.articleId },
    orderBy: { createdAt: "asc" },
    take: Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    select: {
      id: true,
      eventType: true,
      actorType: true,
      actorId: true,
      humanDraftId: true,
      aiGenerationId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return { data: versions, articleId: args.articleId };
}

export const getVersionHistory = withToolGuard("get_version_history", getVersionHistoryHandler);
