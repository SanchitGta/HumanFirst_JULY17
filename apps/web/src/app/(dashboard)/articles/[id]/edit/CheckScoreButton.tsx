"use client";

import { useState } from "react";

export function CheckScoreButton({ articleId }: { articleId: string }) {
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckScore() {
    setError(null);
    const response = await fetch(`/api/articles/${articleId}/check-score`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "CHECK_SCORE_FAILED");
      return;
    }
    const result = await response.json();
    setScore(result.score);
  }

  return (
    <div>
      <button type="button" onClick={handleCheckScore}>
        Check Score
      </button>
      {score !== null && <p>Human Confidence Score: {score}/100</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
