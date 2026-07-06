// F-001 · T-001-14 — copy the committed breached-password fixture into the
// compiled output so `dist/auth/common-passwords.js` can read it at runtime
// (tsc only emits .js/.d.ts, not data files). Run as the second half of the
// core-domain `build` script.
import { mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src", "auth", "fixtures");
const outDir = join(here, "..", "dist", "auth", "fixtures");

mkdirSync(outDir, { recursive: true });
for (const f of ["common-passwords-top10k.txt", "SOURCE.md"]) {
  copyFileSync(join(srcDir, f), join(outDir, f));
}
// eslint-disable-next-line no-console
console.log(`copied fixtures → ${outDir}`);
