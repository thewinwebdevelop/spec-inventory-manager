// Root Prettier config — re-exports the shared config from packages/config
// (T-000-01). Rule content lives in packages/config/prettier/index.js; this
// file only wires it up so `prettier` (invoked by lint-staged, T-000-03) picks
// it up repo-wide without duplicating rule content here.
module.exports = require("./packages/config/prettier/index.js");
