# apps/web — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/web` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

Next.js web app ของ OmniStock (dogfood UI ฝั่ง desktop/browser)
**เจ้าของ:** `frontend` (behavior/code) · flow/copy/visual → `ux` · สร้างใน F-000 T-000-09 (placeholder shell)

## Stack

Next.js (App Router) · TypeScript · consume TS client ที่ generate จาก `@omnistock/contracts`

## โครงสร้าง

- `src/app/` — App Router (route/layout/page); `page.tsx` ปัจจุบันเป็น placeholder ที่ consume type `HealthResponse` จาก `@omnistock/contracts` (พิสูจน์ web↔contract wiring, AC3)
- `next.config.mjs`, `tsconfig.json` (exclude `.next` กัน typecheck race)

## กฎเมื่อแก้

- คุยกับ API ผ่าน **generated TS client** จาก `@omnistock/contracts` เท่านั้น — อย่า hand-write fetch type/endpoint; เปลี่ยน contract ที่ `packages/contracts`
- อย่าตัดสิน API/data shape เอง (→ backend-api) · flow/copy/token ภาษาไทย → ux
- token/session/CSRF/XSS: ทำตาม skill `client-security` (บังคับบน ★ task)

## คำสั่ง (source nvm→node22 + `corepack` ก่อน)

`pnpm --filter web build|typecheck|lint|dev`
