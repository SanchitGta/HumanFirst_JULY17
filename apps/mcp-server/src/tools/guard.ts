import { getPrincipal, type Principal } from "../context.js";
import { checkRateLimit, getRateLimitPerMinute } from "../rateLimit.js";
import { audit } from "../audit.js";
import { ToolError } from "../toolError.js";

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function mcpSuccessResult(data: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function mcpErrorResult(code: string, message: string): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: code, message }) }],
    isError: true,
  };
}

export interface ToolHandlerResult<TResult> {
  data: TResult;
  articleId: string | null;
}

export function withToolGuard<TArgs, TResult>(
  toolName: string,
  handler: (args: TArgs, principal: Principal) => Promise<ToolHandlerResult<TResult>>,
): (args: TArgs) => Promise<McpToolResult> {
  return async (args: TArgs) => {
    const principal = getPrincipal();

    const rate = checkRateLimit(principal.tokenId);
    if (!rate.allowed) {
      await audit({
        toolName,
        principalUserId: principal.userId,
        mcpTokenId: principal.tokenId,
        articleId: null,
        allowed: false,
        reason: "RATE_LIMITED",
      });
      return mcpErrorResult(
        "RATE_LIMITED",
        `Rate limit exceeded: ${getRateLimitPerMinute()} calls/PAT/min.`,
      );
    }

    try {
      const { data, articleId } = await handler(args, principal);
      await audit({
        toolName,
        principalUserId: principal.userId,
        mcpTokenId: principal.tokenId,
        articleId,
        allowed: true,
        reason: null,
      });
      return mcpSuccessResult(data);
    } catch (err) {
      if (err instanceof ToolError) {
        await audit({
          toolName,
          principalUserId: principal.userId,
          mcpTokenId: principal.tokenId,
          articleId: err.articleId,
          allowed: false,
          reason: err.code,
        });
        return mcpErrorResult(err.code, err.message);
      }
      throw err;
    }
  };
}
