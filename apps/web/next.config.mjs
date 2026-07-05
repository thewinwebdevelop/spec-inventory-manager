import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // T-000-09 placeholder shell — no custom config beyond defaults.
  // Real settings (env, images, headers, etc.) land with the features that
  // need them.
  reactStrictMode: true,
  // Pin the monorepo root explicitly — this machine has an unrelated
  // lockfile in the user's home directory that Next.js's root inference
  // otherwise picks up, producing a spurious "multiple lockfiles" warning.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
