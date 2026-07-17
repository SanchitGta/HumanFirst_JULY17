"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateTokenDialog() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const response = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "CREATE_FAILED");
      return;
    }

    const created = await response.json();
    setRawToken(created.token);
  }

  function handleClose() {
    // Discard the raw value from state — it is never shown again.
    setRawToken(null);
    setName("");
    router.refresh();
  }

  if (rawToken) {
    return (
      <div role="dialog" aria-label="New personal access token">
        <p>Copy this token now. You won&apos;t be able to see it again.</p>
        <code>{rawToken}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(rawToken)}>
          Copy
        </button>
        <button type="button" onClick={handleClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate}>
      <label>
        Token name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Create token</button>
    </form>
  );
}
