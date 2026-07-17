import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@humanfirst/db";

const TOKEN_PREFIX = "mcp_pat_";
const RAW_BYTES = 32;
const PREFIX_DISPLAY_LENGTH = 12;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const raw = TOKEN_PREFIX + randomBytes(RAW_BYTES).toString("base64url");
  return {
    raw,
    hash: hashToken(raw),
    prefix: raw.slice(0, PREFIX_DISPLAY_LENGTH),
  };
}

// The exact contract story 13's MCP server must call to resolve and scope every
// tool call — do not re-implement this lookup logic there.
export async function verifyPatAndGetUser(
  raw: string,
): Promise<{ userId: string; tokenId: string } | null> {
  const hash = hashToken(raw);
  const token = await prisma.mCPToken.findUnique({ where: { tokenHash: hash } });

  if (!token || token.revokedAt) {
    return null;
  }

  // Fire-and-forget: last-used tracking must never block or fail the caller.
  void prisma.mCPToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: token.userId, tokenId: token.id };
}
