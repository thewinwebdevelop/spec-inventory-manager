# apps/web — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/web` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

Next.js tenant admin console ของ OmniStock — ฝั่ง setup/config/บัญชี + งานหนัก (bulk, ตารางใหญ่, รายงาน, OAuth connect)
**เจ้าของ:** `frontend` · flow/copy/visual → `ux` · **สถานะ track: พักไว้ (mobile-parity-first)** —
ห้าม build web feature ใหม่ก่อนทำ "จุด restart" ให้เสร็จ (ดู [refactor-plan §5](../../docs/architecture/refactor-plan.md))

> **Architecture authority: [docs/architecture/web.md](../../docs/architecture/web.md)** —
> target design เต็ม + playbook เพิ่ม feature (§3.9) + gap plan (§6)

## Stack

Next.js (App Router) · TypeScript · **Tailwind v4 + shadcn/ui** (D-020 — token map ดู design-system.md §1.5) ·
consume TS client จาก `@omnistock/contracts` เท่านั้น · auth transport ตาม D-019 (cookie refresh + CSRF + access token ใน memory)

## ความจริงเชิงโครงที่ห้ามฝืน (ตัดสินแล้ว — web.md §2)

- **Client-fetch-heavy**: access token อยู่ใน browser memory → RSC render ข้อมูล authenticated ไม่ได้
  · RSC ใช้เฉพาะ login/signup/static shell · middleware gate auth ไม่ได้ (`omni_rt` เป็น `Path=/auth`)
  — auth gating เป็น client-side หลัง JS โหลด
- **Org อยู่ใน URL**: `/o/[orgId]/...` — deep-link ได้ + 2 แท็บ 2 org ได้ · query key namespace ด้วย orgId

## โครงสร้างปัจจุบัน vs target

ตอนนี้มีแค่ F-001 auth (flat `lib/` + `components/`, 121 tests green — ★ security-reviewed, **KEEP verbatim**:
`auth-client.ts`, `csrf.ts`, `token-store.ts`, `api-base.ts` ห้ามแตะโดยไม่มี security review) ·
target = feature-first: `src/features/<f>/{api,components,forms,columns}` + `src/app` เป็น routing ล้วน

## กฎเหล็ก (บังคับกับโค้ดใหม่ทุกชิ้น)

1. คุยกับ API ผ่าน generated TS client จาก `@omnistock/contracts` เท่านั้น — ห้าม hand-write fetch/shape;
   เปลี่ยน contract ที่ `packages/contracts` (→ backend-api)
2. `src/app/` = routing เท่านั้น — ห้ามมี fetch/logic ใน page; import จาก feature/components
3. `components/ui/**` ต้อง feature-agnostic + org-agnostic (back-office จะ reuse ชั้นนี้)
4. **ห้ามคำนวณเงิน/สต๊อกบน client** · mutation เงิน/สต๊อก = pessimistic เสมอ
5. ทุกจอครบ 4 states (skeleton/empty/error/data) · copy ไทยผ่าน `src/i18n/` (ux เป็นเจ้าของ copy) ·
   theme ใช้ Tailwind utility ที่ผูก token เท่านั้น — ห้าม arbitrary value/hardcode สี
6. ★ task (token/session/CSRF/XSS/sensitive render) → skill `client-security` + security-reviewer pass
7. **ทุก task มี unit test ประกบ** (D-014) — `pnpm --filter web test` (vitest) · ห้ามเทสต์แตะ network จริง

## Target patterns — เมื่อ build feature ที่แตะเรื่องนี้ **ให้ implement ตาม arch doc ห้ามคิด pattern เอง**

infra เหล่านี้*ยังไม่มีของจริง* — งาน "จุด restart" + feature แรกที่แตะเป็นผู้สร้างตาม spec:

| เรื่อง | ตาม | เกิดที่ |
|---|---|---|
| TanStack Query (`lib/api/query-client.ts`) — data fetching/invalidation เดียวทั้งแอป (ห้ามลอก manual `useState`+`useEffect` ของ SessionList) | web.md §3.1 | จุด restart |
| `ApiFailure` discriminated union กลาง (generalize จาก `error-messages.ts`) | web.md §3.4 | จุด restart |
| boundary gate `tool/check-boundaries.mjs` (dependency-cruiser) | web.md §5.2 | จุด restart |
| `lib/org/` + `lib/session/` + `app/o/[orgId]/layout` + `useOrgApiClient()` (org header ได้ฟรี) | web.md §3.2 | F-002 |
| `RouteGuard` + `FeatureGate` (`useCan()` RBAC ≠ tier — 2 แกนแยก) | web.md §3.3 | F-003/F-007 |
| `components/ui/data-table/` (TanStack Table + URL-synced state, virtualize >200 แถว) · `form/` (RHF+zod, dirty guard) | web.md §3.5–3.6 | F-010 |
| job polling (`use-job-polling` + `JobStatusBanner` — `GET /jobs/{id}`) · OAuth popup + postMessage | web.md §3.7–3.8 | F-021 · F-020 |

## คำสั่ง (source nvm→node22 + `corepack` ก่อน)

`pnpm --filter web build|typecheck|lint|test|dev`
