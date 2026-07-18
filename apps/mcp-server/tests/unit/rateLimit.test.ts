import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("checkRateLimit", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MCP_RATE_LIMIT_PER_MINUTE;
    delete process.env.MCP_RATE_LIMIT_WINDOW_MS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
  });

  it("allows the first 30 calls for one tokenId and rejects the 31st in the same window", async () => {
    const { checkRateLimit } = await import("../../src/rateLimit.js");
    const tokenId = "token-a";

    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(tokenId).allowed).toBe(true);
    }

    const result = checkRateLimit(tokenId);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks a different tokenId independently", async () => {
    const { checkRateLimit } = await import("../../src/rateLimit.js");

    for (let i = 0; i < 30; i++) {
      checkRateLimit("token-b");
    }
    expect(checkRateLimit("token-b").allowed).toBe(false);
    expect(checkRateLimit("token-c").allowed).toBe(true);
  });

  it("resets the window after MCP_RATE_LIMIT_WINDOW_MS has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { checkRateLimit } = await import("../../src/rateLimit.js");
    const tokenId = "token-d";

    for (let i = 0; i < 30; i++) {
      checkRateLimit(tokenId);
    }
    expect(checkRateLimit(tokenId).allowed).toBe(false);

    vi.setSystemTime(60001);
    expect(checkRateLimit(tokenId).allowed).toBe(true);
  });

  it("respects MCP_RATE_LIMIT_PER_MINUTE env override", async () => {
    process.env.MCP_RATE_LIMIT_PER_MINUTE = "5";
    const { checkRateLimit } = await import("../../src/rateLimit.js");
    const tokenId = "token-e";

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(tokenId).allowed).toBe(true);
    }
    expect(checkRateLimit(tokenId).allowed).toBe(false);
  });
});
