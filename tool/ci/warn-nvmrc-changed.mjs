#!/usr/bin/env node
// F-003 · T-003-DV05 (G3-07) — warn when a PR changes `.nvmrc`.
//
// WHY: the role-name forbidden-character set is defined by the Unicode tables of
// the Node that runs CI (`\p{Cf}`, `\p{Default_Ignorable_Code_Point}` …). The DB
// CHECK `Role_name_shape` is a frozen copy of it. A Node bump can grow the set,
// and the parity gate (packages/db/test/unicode-parity.test.ts +
// apps/api/test/role-name-charset-parity.test.ts) then goes red — this warning
// tells the reviewer WHY before that red run, and what the fix is.
//
// USAGE  node tool/ci/warn-nvmrc-changed.mjs --base <commit-sha-or-ref> [--head HEAD]
// Emits a `::warning::` annotation when `.nvmrc` differs between base and head,
// exit 0 either way (a warning, not a gate). A git failure is FATAL (exit 2) —
// never "no warning because git broke".
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
function fatal(msg) {
  console.error(`::error::[nvmrc-warning] ${msg}`);
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  if (i < 0) return dflt;
  if (argv[i + 1] === undefined) fatal(`missing value for ${name}`);
  return argv[i + 1];
};
const base = opt("--base");
const head = opt("--head", "HEAD");
if (!base) fatal("--base is required");

const git = (...args) => {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.error || r.status === null) fatal(`git ${args.join(" ")} did not run: ${r.error?.message}`);
  return r;
};
const show = (rev) => {
  const r = git("show", `${rev}:.nvmrc`);
  return r.status === 0 ? r.stdout.trim() : "(absent)";
};
const diff = git("diff", "--quiet", base, head, "--", ".nvmrc");
if (diff.status > 1) fatal(`git diff failed: ${diff.stderr.trim()}`);

if (diff.status === 0) {
  console.log("[nvmrc-warning] .nvmrc unchanged — nothing to warn about.");
} else {
  const msg =
    `.nvmrc changed (${show(base)} -> ${show(head)}). The role-name forbidden-character set ` +
    `(F-003 G3-07) follows this Node's Unicode tables; if the parity gate goes red the fix is a NEW ` +
    `migration that re-creates CHECK "Role_name_shape" (never edit an applied one).`;
  console.log(`::warning title=.nvmrc changed::${msg}`);
}
