import { z } from "zod";
import { prisma } from "@humanfirst/db";
import type { Principal } from "../context.js";
import { ToolError } from "../toolError.js";
import { withToolGuard } from "./guard.js";

export const getHumanDraftShape = {
  articleId: z.string(),
  revisionNumber: z.number().int().optional(),
};
const getHumanDraftSchema = z.object(getHumanDraftShape);

async function getHumanDraftHandler(
  args: z.infer<typeof getHumanDraftSchema>,
  principal: Principal,
) {
  const article = await prisma.article.findUnique({ where: { id: args.articleId } });
  if (!article) {
    throw new ToolError("NOT_FOUND", "Article not found", args.articleId);
  }
  if (article.authorId !== principal.userId) {
    throw new ToolError("FORBIDDEN", "Article is not owned by this PAT's user", args.articleId);
  }
  if (article.status !== "LOCKED" && article.status !== "PUBLISHED") {
    throw new ToolError(
      "NOT_LOCKED",
      "Human draft is not available until the article is locked or published",
      args.articleId,
    );
  }

  const draft =
    args.revisionNumber !== undefined
      ? await prisma.humanDraft.findUnique({
          where: {
            articleId_revisionNumber: {
              articleId: args.articleId,
              revisionNumber: args.revisionNumber,
            },
          },
        })
      : await prisma.humanDraft.findFirst({
          where: { articleId: args.articleId },
          orderBy: { revisionNumber: "desc" },
        });

  if (!draft) {
    throw new ToolError("NOT_FOUND", "No human draft revision found", args.articleId);
  }

  return {
    data: {
      id: draft.id,
      revisionNumber: draft.revisionNumber,
      contentJson: draft.contentJson,
      checksum: draft.checksum,
      typingAnalyticsSnapshot: draft.typingAnalyticsSnapshot,
      verificationResult: draft.verificationResult,
      createdAt: draft.createdAt,
    },
    articleId: args.articleId,
  };
}

export const getHumanDraft = withToolGuard("get_human_draft", getHumanDraftHandler);
