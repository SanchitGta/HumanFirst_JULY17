import { it } from "vitest";
import { RuleTester } from "eslint";
import rule from "./prisma-read-only.js";

it("prisma-read-only rule", () => {
  const ruleTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  });

  ruleTester.run("prisma-read-only", rule, {
    valid: [
      "prisma.article.findUnique({ where: { id } });",
      "prisma.article.findMany({ where: { authorId } });",
      "prisma.article.findFirst({ where: { articleId } });",
      "somethingElse.article.create({ data: {} });",
    ],
    invalid: [
      {
        code: "prisma.article.create({ data: {} });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.article.update({ where: { id }, data: {} });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.article.updateMany({ where: {}, data: {} });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.article.delete({ where: { id } });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.article.deleteMany({ where: {} });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.article.upsert({ where: { id }, create: {}, update: {} });",
        errors: [{ messageId: "forbiddenMethod" }],
      },
      {
        code: "prisma.$transaction([]);",
        errors: [{ messageId: "forbiddenRaw" }],
      },
      {
        code: "prisma.$executeRaw`DELETE FROM \"Article\"`;",
        errors: [{ messageId: "forbiddenRaw" }],
      },
      {
        code: "prisma.$queryRawUnsafe('SELECT 1');",
        errors: [{ messageId: "forbiddenRaw" }],
      },
    ],
  });
});
