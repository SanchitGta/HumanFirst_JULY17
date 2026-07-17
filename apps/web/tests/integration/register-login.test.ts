import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  handle: string;
  passwordHash: string | null;
}

interface FakeSession {
  sessionToken: string;
  userId: string;
  expires: Date;
}

const users = new Map<string, FakeUser>();
const sessions = new Map<string, FakeSession>();

function findUserByEmail(email: string) {
  return [...users.values()].find((u) => u.email === email) ?? null;
}
function findUserByHandle(handle: string) {
  return [...users.values()].find((u) => u.handle === handle) ?? null;
}

vi.mock("@humanfirst/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.email) return findUserByEmail(where.email);
        if (where.handle) return findUserByHandle(where.handle);
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const user: FakeUser = { id: randomUUID(), ...data, passwordHash: data.passwordHash ?? null };
        users.set(user.id, user);
        return user;
      }),
    },
    session: {
      create: vi.fn(async ({ data }: any) => {
        const session: FakeSession = data;
        sessions.set(session.sessionToken, session);
        return session;
      }),
    },
  },
}));

// Avoid triggering real NextAuth() initialization (which needs live env config);
// lib/session.ts only needs the resolved cookie name/options off authConfig.
vi.mock("@/auth", () => ({
  authConfig: {
    cookies: {
      sessionToken: { name: "authjs.session-token", options: {} },
    },
  },
}));

import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("register/login integration", () => {
  beforeEach(() => {
    users.clear();
    sessions.clear();
    vi.clearAllMocks();
  });

  it("registers a new user, sets a session cookie, and creates a DB session row", async () => {
    const response = await register(
      jsonRequest("/api/auth/register", {
        email: "new@example.com",
        password: "correct-horse-battery-staple",
        name: "New User",
        handle: "newuser",
      }),
    );

    expect(response.status).toBe(201);
    const cookie = response.cookies.get("authjs.session-token");
    expect(cookie?.value).toBeTruthy();
    expect(sessions.has(cookie!.value)).toBe(true);
    expect(sessions.get(cookie!.value)?.userId).toEqual(findUserByEmail("new@example.com")?.id);
  });

  it("rejects registration with a taken email", async () => {
    await register(
      jsonRequest("/api/auth/register", {
        email: "dup@example.com",
        password: "correct-horse-battery-staple",
        name: "First",
        handle: "first",
      }),
    );

    const response = await register(
      jsonRequest("/api/auth/register", {
        email: "dup@example.com",
        password: "another-password",
        name: "Second",
        handle: "second",
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("EMAIL_TAKEN");
  });

  it("rejects registration with a reserved handle", async () => {
    const response = await register(
      jsonRequest("/api/auth/register", {
        email: "blog@example.com",
        password: "correct-horse-battery-staple",
        name: "Blog",
        handle: "blog",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("logs in with correct credentials and creates a new DB session row", async () => {
    await register(
      jsonRequest("/api/auth/register", {
        email: "login@example.com",
        password: "correct-horse-battery-staple",
        name: "Login User",
        handle: "loginuser",
      }),
    );
    sessions.clear(); // isolate the login-created session from the register-created one

    const response = await login(
      jsonRequest("/api/auth/login", { email: "login@example.com", password: "correct-horse-battery-staple" }),
    );

    expect(response.status).toBe(200);
    const cookie = response.cookies.get("authjs.session-token");
    expect(sessions.has(cookie!.value)).toBe(true);
  });

  it("rejects login with the wrong password and creates no session row", async () => {
    await register(
      jsonRequest("/api/auth/register", {
        email: "wrongpw@example.com",
        password: "correct-horse-battery-staple",
        name: "User",
        handle: "wrongpwuser",
      }),
    );
    sessions.clear();

    const response = await login(
      jsonRequest("/api/auth/login", { email: "wrongpw@example.com", password: "totally-wrong" }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("INVALID_CREDENTIALS");
    expect(sessions.size).toBe(0);
  });

  it("rejects login for an OAuth-only user (no passwordHash)", async () => {
    const oauthUser: FakeUser = {
      id: randomUUID(),
      email: "oauth@example.com",
      name: "OAuth User",
      handle: "oauthuser",
      passwordHash: null,
    };
    users.set(oauthUser.id, oauthUser);

    const response = await login(
      jsonRequest("/api/auth/login", { email: "oauth@example.com", password: "anything" }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("INVALID_CREDENTIALS");
  });
});
