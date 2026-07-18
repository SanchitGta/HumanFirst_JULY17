import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.MCP_AUDIT_DATABASE_URL });

export interface AuditParams {
  toolName: string;
  principalUserId: string | null;
  mcpTokenId: string | null;
  articleId: string | null;
  allowed: boolean;
  reason: string | null;
}

// Failures never block or fail the caller — matches verifyPatAndGetUser's own
// fire-and-forget precedent for non-blocking side effects (fail-open, by design).
export async function audit(params: AuditParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "AuditLog" (id, "toolName", "principalUserId", "mcpTokenId", "articleId", allowed, reason, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        params.toolName,
        params.principalUserId,
        params.mcpTokenId,
        params.articleId,
        params.allowed,
        params.reason,
        new Date(),
      ],
    );
  } catch (err) {
    console.error("Failed to write AuditLog row", err);
  }
}
