/**
 * Restricts every Prisma call in the files this rule is applied to
 * (apps/mcp-server/src/** per eslint.config.js) to findUnique/findFirst/findMany.
 * Pure AST-shape match — no type information needed.
 */

const ALLOWED_METHODS = new Set(["findUnique", "findFirst", "findMany"]);

/** @type {import("eslint").Rule.RuleModule} */
const prismaReadOnlyRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Restrict Prisma client calls in apps/mcp-server to read-only methods (findUnique/findFirst/findMany).",
    },
    schema: [
      {
        type: "object",
        properties: {
          clientNames: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenMethod:
        "'{{clientName}}.{{method}}()' is forbidden in apps/mcp-server — only findUnique, findFirst, and findMany are permitted.",
      forbiddenRaw:
        "'{{clientName}}.{{method}}' is forbidden in apps/mcp-server — only findUnique, findFirst, and findMany are permitted.",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const clientNames = new Set(options.clientNames || ["prisma"]);

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;

        // prisma.$transaction(...), prisma.$queryRaw(...), prisma.$executeRaw(...), etc.
        if (
          callee.object.type === "Identifier" &&
          clientNames.has(callee.object.name) &&
          callee.property.type === "Identifier" &&
          callee.property.name.startsWith("$")
        ) {
          context.report({
            node,
            messageId: "forbiddenRaw",
            data: { clientName: callee.object.name, method: callee.property.name },
          });
          return;
        }

        // prisma.<model>.<method>(...)
        if (
          callee.object.type === "MemberExpression" &&
          callee.object.object.type === "Identifier" &&
          clientNames.has(callee.object.object.name) &&
          callee.property.type === "Identifier" &&
          !ALLOWED_METHODS.has(callee.property.name)
        ) {
          context.report({
            node,
            messageId: "forbiddenMethod",
            data: { clientName: callee.object.object.name, method: callee.property.name },
          });
        }
      },
    };
  },
};

export default prismaReadOnlyRule;
