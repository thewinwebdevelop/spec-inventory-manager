// Shared ESLint base config, extended by each workspace's local eslint config.
// T-000-01 shipped this as JS-only (parses only plain JS); this revision adds
// real TypeScript linting (fixing the gap where every workspace's `lint`
// script was a no-op and .ts files hit a parser error under eslint:recommended
// alone). Kept intentionally light — recommended TS rules only, no
// type-aware ("project") linting, so the gate stays fast and doesn't require
// wiring a tsconfig path per workspace into this shared file.
module.exports = {
  root: false,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {},
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      extends: ["plugin:@typescript-eslint/recommended"],
      rules: {
        // NestJS/Prisma-style code leans on decorators + DI patterns where an
        // explicit `any` or an intentionally-unused constructor param (e.g.
        // Nest injecting a token you don't reference directly) is normal for
        // a scaffold. Turned off here rather than scattering per-line disable
        // directive comments across every module/controller.
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
      },
    },
  ],
};
