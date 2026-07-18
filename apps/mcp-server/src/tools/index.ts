import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listArticles, listArticlesShape, getArticle, getArticleShape, searchArticles, searchArticlesShape } from "./articles.js";
import { getHumanDraft, getHumanDraftShape } from "./humanDraft.js";
import { listAiGenerations, listAiGenerationsShape } from "./aiGenerations.js";
import { getSkill, getSkillShape, listSkills, listSkillsShape } from "./skills.js";
import { getVersionHistory, getVersionHistoryShape } from "./versionHistory.js";

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    "list_articles",
    { description: "List the caller's own articles.", inputSchema: listArticlesShape },
    listArticles,
  );
  server.registerTool(
    "get_article",
    { description: "Get one of the caller's own articles by id.", inputSchema: getArticleShape },
    getArticle,
  );
  server.registerTool(
    "search_articles",
    { description: "Search the caller's own articles by title/tag.", inputSchema: searchArticlesShape },
    searchArticles,
  );
  server.registerTool(
    "get_human_draft",
    {
      description:
        "Get the human-authored draft content for one of the caller's own articles. Only available once the article is LOCKED or PUBLISHED.",
      inputSchema: getHumanDraftShape,
    },
    getHumanDraft,
  );
  server.registerTool(
    "list_ai_generations",
    { description: "List AI generations for one of the caller's own articles.", inputSchema: listAiGenerationsShape },
    listAiGenerations,
  );
  server.registerTool(
    "get_skill",
    { description: "Get one of the caller's own skills by id.", inputSchema: getSkillShape },
    getSkill,
  );
  server.registerTool(
    "list_skills",
    { description: "List the caller's own skills.", inputSchema: listSkillsShape },
    listSkills,
  );
  server.registerTool(
    "get_version_history",
    { description: "Get the version history for one of the caller's own articles.", inputSchema: getVersionHistoryShape },
    getVersionHistory,
  );
}
