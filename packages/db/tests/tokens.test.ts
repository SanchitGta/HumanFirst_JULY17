import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const mcpTokenStore = new Map<string, any>();

vi.mock("../src/client", () => ({
  prisma: {
    mCPToken: {
      findUnique: vi.fn(async ({ where: { tokenHash } }: any) => {
        for (const token of mcpTokenStore.values()) {
          if (token.tokenHash === tokenHash) return token;
        }
        return null;
      }),
      update: vi.fn(async ({ where: { id }, data }: any) => {
        const existing = mcpTokenStore.get(id);
        const updated = { ...existing, ...data };
        mcpTokenStore.set(id, updated);
        return updated;
      }),
    },
  },
}));

import { generateToken, hashToken, verifyPatAndGetUser } from "../src/tokens";

describe("tokens", () => {
  beforeEach(() => {
    mcpTokenStore.clear();
    vi.clearAllMocks();
  });

  describe("generateToken", () => {
    it("produces a raw token with the mcp_pat_ prefix", () => {
      const { raw } = generateToken();
      expect(raw.startsWith("mcp_pat_")).toBe(true);
    });

    it("hash matches sha256(raw)", () => {
      const { raw, hash } = generateToken();
      expect(hash).toEqual(createHash("sha256").update(raw).digest("hex"));
    });

    it("prefix is the first 12 characters of raw", () => {
      const { raw, prefix } = generateToken();
      expect(prefix).toEqual(raw.slice(0, 12));
    });

    it("generates unique raw tokens across calls", () => {
      const seen = new Set<string>();
      for (let i = 0; i < 50; i++) {
        seen.add(generateToken().raw);
      }
      expect(seen.size).toBe(50);
    });
  });

  describe("hashToken", () => {
    it("is deterministic for the same input", () => {
      expect(hashToken("mcp_pat_abc")).toEqual(hashToken("mcp_pat_abc"));
    });

    it("differs for different inputs", () => {
      expect(hashToken("mcp_pat_abc")).not.toEqual(hashToken("mcp_pat_def"));
    });
  });

  describe("verifyPatAndGetUser", () => {
    it("returns the owning userId for a valid, non-revoked token", async () => {
      const { raw, hash, prefix } = generateToken();
      mcpTokenStore.set("token-1", {
        id: "token-1",
        userId: "user-1",
        tokenHash: hash,
        tokenPrefix: prefix,
        revokedAt: null,
      });

      const result = await verifyPatAndGetUser(raw);
      expect(result).toEqual({ userId: "user-1", tokenId: "token-1" });
    });

    it("returns null for an unknown token", async () => {
      const result = await verifyPatAndGetUser("mcp_pat_does-not-exist");
      expect(result).toBeNull();
    });

    it("returns null for a revoked token", async () => {
      const { raw, hash, prefix } = generateToken();
      mcpTokenStore.set("token-2", {
        id: "token-2",
        userId: "user-2",
        tokenHash: hash,
        tokenPrefix: prefix,
        revokedAt: new Date(),
      });

      const result = await verifyPatAndGetUser(raw);
      expect(result).toBeNull();
    });
  });
});
