import { describe, expect, it, vi, beforeEach } from "vitest";

const verifyPatAndGetUser = vi.fn();

vi.mock("@humanfirst/db", () => ({
  verifyPatAndGetUser: (...args: unknown[]) => verifyPatAndGetUser(...args),
}));

import { extractBearerToken, patAuthMiddleware } from "../../src/auth.js";
import { requestContext } from "../../src/context.js";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("extractBearerToken", () => {
  it("extracts the token from a well-formed Bearer header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for a missing header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for a malformed scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken("abc123")).toBeNull();
  });
});

describe("patAuthMiddleware", () => {
  beforeEach(() => {
    verifyPatAndGetUser.mockReset();
  });

  it("calls next() and sets the principal in requestContext for a valid token", async () => {
    verifyPatAndGetUser.mockResolvedValue({ userId: "user-1", tokenId: "token-1" });
    const req: any = { headers: { authorization: "Bearer good-token" } };
    const res = mockRes();
    let observedPrincipal: unknown = null;
    const next = vi.fn(() => {
      observedPrincipal = requestContext.getStore();
    });

    await patAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(observedPrincipal).toEqual({ userId: "user-1", tokenId: "token-1" });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 401 UNAUTHENTICATED and does not call next() when the header is missing", async () => {
    const req: any = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await patAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "UNAUTHENTICATED" });
  });

  it("responds 401 UNAUTHENTICATED and does not call next() when the token is invalid/revoked", async () => {
    verifyPatAndGetUser.mockResolvedValue(null);
    const req: any = { headers: { authorization: "Bearer bad-token" } };
    const res = mockRes();
    const next = vi.fn();

    await patAuthMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "UNAUTHENTICATED" });
  });
});
