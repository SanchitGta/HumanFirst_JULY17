import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@humanfirst/db";
import { NewArticleButton } from "./NewArticleButton";

export default async function ArticlesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const articles = await prisma.article.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main>
      <h1>Articles</h1>
      <NewArticleButton />
      <ul>
        {articles.map((article) => (
          <li key={article.id}>
            <Link href={`/articles/${article.id}/edit`}>
              {article.title} — {article.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
