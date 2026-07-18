import tsParser from "@typescript-eslint/parser";
import prismaReadOnly from "./eslint-rules/prisma-read-only.js";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      local: {
        rules: {
          "prisma-read-only": prismaReadOnly,
        },
      },
    },
    rules: {
      "local/prisma-read-only": "error",
    },
  },
];
