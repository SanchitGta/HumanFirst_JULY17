"use client";

import { useRouter } from "next/navigation";

export function RevokeTokenButton({ tokenId }: { tokenId: string }) {
  const router = useRouter();

  async function handleRevoke() {
    await fetch(`/api/tokens/${tokenId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button type="button" onClick={handleRevoke}>
      Revoke
    </button>
  );
}
