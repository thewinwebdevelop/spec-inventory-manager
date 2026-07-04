// Placeholder — establishes the package location for backend-api's
// core-domain purity rule (T-000-06 owns the actual rule content + negative
// fixture assertion). Scaffolded here only so the file/path exists for other
// tasks to build on.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "../tsconfig/base.json",
    },
  },
};
