import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

interface FakeMCPToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const mcpTokens = new Map<string, FakeMCPToken>();
let currentSessionUserId: string | null = "user-1";

vi.mock("@humanfirst/db", () => ({
  prisma: {
    mCPToken: {
      create: vi.fn(async ({ data }: any) => {
        const token: FakeMCPToken = {
          id: randomUUID(),
          lastUsedAt: null,
          revokedAt: null,
          createdAt: new Date(),
          ...data,
        };
        mcpTokens.set(token.id, token);
        return token;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return [...mcpTokens.values()].filter((t) => t.userId === where.userId);
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return mcpTokens.get(where.id) ?? null;
        if (where.tokenHash) {
          return [...mcpTokens.values()].find((t) => t.tokenHash === where.tokenHash) ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where: { id }, data }: any) => {
        const existing = mcpTokens.get(id)!;
        const updated = { ...existing, ...data };
        mcpTokens.set(id, updated);
        return updated;
      }),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null)),
}));

import { POST as createToken, GET as listTokens } from "@/app/api/tokens/route";
import { DELETE as revokeToken } from "@/app/api/tokens/[id]/route";
import { verifyPatAndGetUser } from "@/lib/tokens";

function req(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost"), init);
}

describe("PAT issuance/listing/revocation integration", () => {
  beforeEach(() => {
    mcpTokens.clear();
    currentSessionUserId = "user-1";
    vi.clearAllMocks();
  });

  it("issues a token, returns the raw value once, and never leaks tokenHash via GET", async () => {
    const createResponse = await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "CI token" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(typeof created.token).toBe("string");
    expect(created.token.startsWith("mcp_pat_")).toBe(true);

    const listResponse = await listTokens();
    const list = await listResponse.json();
    expect(list).toHaveLength(1);
    expect(list[0].tokenHash).toBeUndefined();
    expect(list[0].token).toBeUndefined();
    expect(list[0].tokenPrefix).toEqual(created.tokenPrefix);
  });

  it("requires authentication to issue a token", async () => {
    currentSessionUserId = null;
    const response = await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "CI token" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("scopes GET /api/tokens to the calling user only", async () => {
    currentSessionUserId = "user-1";
    await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "user-1 token" }),
      }),
    );

    currentSessionUserId = "user-2";
    await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "user-2 token" }),
      }),
    );

    currentSessionUserId = "user-1";
    const listResponse = await listTokens();
    const list = await listResponse.json();
    expect(list).toHaveLength(1);
    expect(list[0].name).toEqual("user-1 token");
  });

  it("revokes a token owned by the caller, and verifyPatAndGetUser then returns null", async () => {
    const createResponse = await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "to revoke" }),
      }),
    );
    const created = await createResponse.json();

    const deleteResponse = await revokeToken(req(`/api/tokens/${created.id}`, { method: "DELETE" }), {
      params: { id: created.id },
    });
    expect(deleteResponse.status).toBe(204);

    const result = await verifyPatAndGetUser(created.token);
    expect(result).toBeNull();
  });

  it("returns 403 when a non-owner attempts to revoke a token (PAT-scoped denial, not content)", async () => {
    currentSessionUserId = "user-1";
    const createResponse = await createToken(
      req("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "user-1 token" }),
      }),
    );
    const created = await createResponse.json();

    currentSessionUserId = "user-2";
    const deleteResponse = await revokeToken(req(`/api/tokens/${created.id}`, { method: "DELETE" }), {
      params: { id: created.id },
    });
    expect(deleteResponse.status).toBe(403);

    const result = await verifyPatAndGetUser(created.token);
    expect(result?.userId).toEqual("user-1");
  });

  it("returns 404 when revoking a token that does not exist", async () => {
    const deleteResponse = await revokeToken(req("/api/tokens/does-not-exist", { method: "DELETE" }), {
      params: { id: "does-not-exist" },
    });
    expect(deleteResponse.status).toBe(404);
  });
});
