import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@humanfirst/db";
import { CreateTokenDialog } from "./CreateTokenDialog";
import { RevokeTokenButton } from "./RevokeTokenButton";

export default async function TokensSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tokens = await prisma.mCPToken.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <h1>Personal access tokens</h1>
      <CreateTokenDialog />
      <ul>
        {tokens.map((token) => (
          <li key={token.id}>
            <span>{token.name}</span>
            <code>{token.tokenPrefix}…</code>
            {token.revokedAt ? <span> revoked</span> : <RevokeTokenButton tokenId={token.id} />}
          </li>
        ))}
      </ul>
    </main>
  );
}
