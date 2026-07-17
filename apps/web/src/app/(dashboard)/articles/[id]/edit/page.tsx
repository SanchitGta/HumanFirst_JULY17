import { notFound, redirect } from "next/navigation";
import { prisma } from "@humanfirst/db";
import { auth } from "@/auth";
import { Editor } from "./Editor";

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { draftRevision: true },
  });

  // 404, not 403 — do not confirm existence to non-owners.
  if (!article || article.authorId !== session.user.id) {
    notFound();
  }

  if (article.status !== "DRAFTING") {
    // Full locked/read-only render of the human draft is story 12's scope.
    return (
      <main>
        <p>This article is locked and read-only in this view.</p>
      </main>
    );
  }

  return (
    <Editor
      articleId={article.id}
      initialContentJson={article.draftRevision!.contentJson}
      initialPasteViolationCount={article.draftRevision!.pasteViolationCount}
    />
  );
}
