import { AsyncLocalStorage } from "node:async_hooks";

export interface Principal {
  userId: string;
  tokenId: string;
}

export const requestContext = new AsyncLocalStorage<Principal>();

export function getPrincipal(): Principal {
  const principal = requestContext.getStore();
  if (!principal) {
    throw new Error("getPrincipal() called outside of an authenticated request context");
  }
  return principal;
}
