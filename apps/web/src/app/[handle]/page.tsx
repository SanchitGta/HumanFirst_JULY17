import { notFound } from "next/navigation";
import { prisma } from "@humanfirst/db";

// Must be app/[handle]/page.tsx, NOT app/@handle/... — "@handle" is reserved by
// Next.js for parallel routes and would never match the literal /@sanchit path.
export default async function HandlePage({ params }: { params: { handle: string } }) {
  const stripped = params.handle.startsWith("@") ? params.handle.slice(1) : params.handle;

  const user = await prisma.user.findUnique({ where: { handle: stripped } });
  if (!user) {
    notFound();
  }

  return (
    <main>
      <h1>{user.name ?? user.handle}</h1>
      <p>@{user.handle}</p>
    </main>
  );
}
