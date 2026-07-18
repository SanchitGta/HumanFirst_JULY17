import type { NextFunction, Request, Response } from "express";
import { verifyPatAndGetUser } from "@humanfirst/db";
import { requestContext } from "./context.js";

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function patAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const raw = extractBearerToken(req.headers.authorization);
  if (!raw) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }

  const principal = await verifyPatAndGetUser(raw);
  if (!principal) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }

  requestContext.run(principal, () => next());
}
