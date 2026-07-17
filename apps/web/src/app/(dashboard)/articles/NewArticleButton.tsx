"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewArticleButton() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "CREATE_FAILED");
      return;
    }

    const created = await response.json();
    router.push(`/articles/${created.id}/edit`);
  }

  return (
    <form onSubmit={handleCreate}>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">New article</button>
    </form>
  );
}
