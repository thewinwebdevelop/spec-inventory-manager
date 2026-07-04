// Shared ESLint base config, extended by each workspace's local eslint config.
// Placeholder scaffold (T-000-01) — rule content/tuning is filled in as
// workspaces adopt it; kept minimal and dependency-free here.
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
};
