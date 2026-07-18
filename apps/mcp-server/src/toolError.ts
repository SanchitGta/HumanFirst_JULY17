export type ToolErrorCode = "NOT_FOUND" | "FORBIDDEN" | "NOT_LOCKED";

export class ToolError extends Error {
  code: ToolErrorCode;
  articleId: string | null;

  constructor(code: ToolErrorCode, message: string, articleId: string | null = null) {
    super(message);
    this.code = code;
    this.articleId = articleId;
  }
}
