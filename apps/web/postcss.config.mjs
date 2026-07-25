/**
 * Tailwind v4 uses a dedicated PostCSS plugin package instead of the old
 * `tailwindcss` PostCSS entry (D-020 — Tailwind v4 + shadcn/ui migration).
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
