"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "LOGIN_FAILED");
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    await signIn("nodemailer", { email: magicLinkEmail });
  }

  return (
    <main>
      <h1>Log in</h1>

      <form onSubmit={handlePasswordLogin}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Log in</button>
      </form>

      <button type="button" onClick={() => signIn("google")}>
        Continue with Google
      </button>

      <form onSubmit={handleMagicLink}>
        <label>
          Email for magic link
          <input
            type="email"
            value={magicLinkEmail}
            onChange={(e) => setMagicLinkEmail(e.target.value)}
            required
          />
        </label>
        <button type="submit">Send magic link</button>
      </form>
    </main>
  );
}
