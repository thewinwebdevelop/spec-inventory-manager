# Web Architecture (definitive) — apps/web สำหรับ backlog เต็ม ~40+ features

> **สถานะ: proposed (2026-07-11)** — ผลของรอบ "architecture deep-design" ตาม
> [design-brief.md](design-brief.md) §4 · ออกแบบจากศูนย์แล้วค่อยเทียบกับโค้ดจริง (§6)
> เอกสารนี้คือ blueprint ที่ web track **restart** ตอน mobile MVP เสร็จ (docs/06 — mobile-parity-first,
> tenant web พักไว้ตอนนี้) — ความถูกต้องสำคัญกว่าความเร็ว เพราะจะไม่มีใครมาทบทวนอีกจนกว่าจะถึงวันนั้น
> ใช้คู่กับ: [docs/06-clients.md](../06-clients.md) (บทบาท web) · [docs/design-system.md](../design-system.md)
> (tokens/4 states) · [docs/architecture/mobile.md](mobile.md) (semantics ที่ web ต้อง mirror)

---

## §1 Design goals + เคสจาก design-brief ที่ต้องตอบ

### 1.1 แรงกดดันจริงที่โครงต้องรับ

1. **Web = admin console ฝั่ง setup + งานหนัก** (docs/06) — OAuth connect, product import + listing
   mapping, price management, returns, เอกสารบัญชีไทย (PDF, เลขรันภาษี), รายงาน/export ลึก, bulk CSV,
   plan/billing UI — งานที่ "จอใหญ่ ตารางใหญ่ ฟอร์มหนัก" ทำได้ดีกว่ามือถือ ไม่ใช่แค่ "mobile screen ที่ขยายจอ"
2. **auth transport ล็อกแล้ว (D-019/D-020, client-security review ผ่านแล้ว)** — access token อยู่ใน
   memory ฝั่ง browser, refresh token เป็น `omni_rt` httpOnly cookie **`Path=/auth` เท่านั้น**, CSRF
   double-submit ผ่าน `omni_csrf` (`Path=/`) — ข้อจำกัดนี้กำหนดว่า RSC ทำอะไรได้จริงบ้าง (§2.3, §3.1)
3. **ทีมที่ build คือ AI agent ปั๊มทีละ feature** — เหมือน mobile: pattern ต้องสั้น สอนได้ ทำซ้ำได้
   invariant สำคัญ (org-scope, error mapping, 4 states) ต้อง **ได้ฟรีจากโครง**
4. **apps/back-office (Next.js แยกแอป, Phase 5) ต้อง reuse shared UI infra ได้** — `components/ui/`
   design-system primitives ต้อง feature-agnostic + org-agnostic ตั้งแต่วันแรก (ไม่ผูก tenant-only concept)
5. **ห้ามคำนวณเงิน/สต๊อกบน client** (กฎทอง) — web เป็นจอแสดงผล + จอสั่ง action เหมือน mobile

### 1.2 ตาราง case coverage (จาก design-brief §2 — เฉพาะที่ระบุให้ web ตอบ)

| Case | คำตอบเชิงโครง (ชี้ § ในเอกสารนี้) |
|---|---|
| **A3** feature ใหม่ = โฟลเดอร์ใหม่ ไม่แตะของเก่า | feature-first `features/<f>/` + จุด register 2 จุด (route ใน `app/o/[orgId]/`, i18n dict) (§2, §3.9 playbook) |
| **B1** ทุก query ผูก organizationId | **org ใน URL** (`/o/[orgId]/...`) + org-scoped query client ที่ feature ต้อง `useActiveOrg()` เพื่อสร้าง client — ลืมไม่ได้เชิงโครงสร้าง (§3.2) |
| **B2** FeatureGate declarative ทุก surface | `<FeatureGate feature>` component + `useEntitled()` — เหมือน mobile แต่ Next.js ไม่มี declarative route-metadata guard จึงใช้ `<RouteGuard>` wrapper ต่อ route segment แทน (§3.3) |
| **B3** RBAC capability check ไม่ปนกับ B2 | `useCan(capability)` แยก hook จาก `useEntitled(feature)` — คนละ context field, ประกอบกันที่จุดใช้ (§3.3) |
| **B4** ledger immutability | UI สต๊อก = ฟอร์ม "บันทึกการเคลื่อนไหว" เสมอ ไม่มีจอ "แก้ตัวเลข"; mutation เงิน/สต๊อกเป็น pessimistic เท่านั้น (§3.6) |
| **B5** Money Decimal / stock int / Asia-Bangkok | `lib/format/` เท่านั้นที่ format จาก server string — ไม่มี money math บน client (§3.6, §4.3) |
| **B6** error taxonomy กลาง + ไทย | `ApiFailure` discriminated union ใน `lib/api/error.ts` + `failureMessage()` → shadcn toast/banner (§3.4) |
| **B7** audit log | ทุก action ผ่าน API (server audit) — web ไม่เก็บ log เอง |
| **B8** testability D-014 | ทุกชั้นมี test wrapper (`renderWithProviders`) override ได้ — ไม่มีเทสต์แตะ network จริง (§5) |
| **D2** real-time-ish updates | TanStack Query `refetchOnWindowFocus` + targeted `refetchInterval` + mutation-success invalidation (query cache = event bus โดยปริยาย, ไม่ต้องมี WebSocket) (§3.7) |
| **D3** list 1k–10k | **หนึ่ง `DataTable` pattern** — server pagination/sort/filter, URL-synced state, bulk selection, virtualization เกิน threshold (§3.5) |
| **D4** form หนัก + validation ไทย | react-hook-form + zod, dirty-guard, multi-step wizard (§3.6) |
| **D5** org switch กระทบทุกจอ | org ใน URL → เปลี่ยน orgId = navigation ใหม่ → query key เปลี่ยน (namespaced ด้วย orgId) → cache เก่าไม่ถูกอ่านอีก ไม่ต้อง "wipe" มือ (§3.2) |
| **D8** 4 states ทุกจอ | `<QueryStateView>` บังคับ skeleton/empty/error/data ครบทุกจออ่านข้อมูล (§3.1, mirror mobile's `AsyncStateView`) |
| **D9** performance | RSC สำหรับ static/marketing เท่านั้น, client-fetch-heavy สำหรับ org data, bundle split ต่อ route, budget ชัด (§4) |
| **E1** OpenAPI contract เดียว | generated TS client (`@omnistock/contracts`) เป็นทางเดียวเข้า API — import ได้เฉพาะ `features/*/api/**` + `lib/api/**` (§2.3 rule 3) |

---

## §2 Target architecture

### 2.1 Pattern หลัก: feature-first App Router + thin `app/` (เทียบ mobile's feature-first 4 layers)

เทียบตัวเลือกจากศูนย์ (สเกล 40+ features, agent ปั๊มซ้ำ):

| เกณฑ์ | **feature-first + thin `app/`(เลือก)** | logic ฝังใน `app/` ตรง ๆ (route-colocated) | layer-first ทั้งแอป (`hooks/`, `services/`, `components/` ระดับ root) |
|---|---|---|---|
| A3: เพิ่ม feature ไม่แตะของเก่า | โฟลเดอร์ใหม่ `features/<f>/` + 1 บรรทัด import ใน `app/o/[orgId]/<f>/page.tsx` | งานกระจายอยู่ใต้ `app/` ปนกับ routing concern — Next.js special files (`loading.tsx`, `error.tsx`) จะเริ่มมี business logic แทรก | งาน 1 feature กระจาย 3-4 โฟลเดอร์ยักษ์ระดับ root — merge conflict ข้าม agent สูง เหมือนที่ mobile ปฏิเสธไปแล้ว |
| Next.js App Router idiom | `app/` ทำหน้าที่ routing/layout/streaming boundary ตามที่ Next.js ออกแบบไว้ — ไม่ขัดกับ framework | ขัดกับคำแนะนำ Next.js เอง (colocate ได้ แต่ scale ไม่ดีเกิน 5-6 routes) | เป็นกลาง แต่เสีย co-location benefit ของ App Router (streaming/loading ต่อ segment) |
| AI agent ปั๊มซ้ำ | exemplar 1 feature (`features/auth/`) ลอกได้ทั้งโครง เหมือน mobile's `features/auth/` | หาไฟล์ยาก เพราะ "feature" ไม่ใช่หน่วยของโฟลเดอร์ | ลอกยาก (ต้องรู้ 3-4 ที่ต่อ 1 feature) |
| Reuse โดย back-office (Phase 5) | `components/ui/**` แยกจาก `features/**` ชัด — back-office import เฉพาะ `components/ui/**` ได้โดยไม่ลาก tenant business logic มาด้วย | components ปนอยู่ใต้ `app/` เฉพาะ tenant, reuse ยาก | เป็นกลาง (ก็แยก `components/` อยู่แล้ว) |

**สรุปการแบ่งงาน:**

- `app/` — **routing เท่านั้น**: route params → props, layout composition (Server + Client component
  ผสมกันตาม §2.3), Next.js special files (`loading.tsx`/`error.tsx`/`not-found.tsx`) ที่ **เรียก component
  จาก `features/*`** ไม่ประกาศ logic เอง
- `features/<f>/` — หน่วยเดียวที่ business/UI logic ของ feature นั้นอยู่: `api/` (TanStack Query hooks),
  `components/` (screen-level + list/detail widgets), `forms/` (RHF+zod schema+form), `columns/` (data-table
  column defs) — **ความลึกที่พอดี**: ไม่บังคับมี `domain/` แยกเหมือน mobile เพราะ web ไม่มี pure-Dart-testable
  entity concern แบบเดียวกัน (validation schema = zod ก็ pure อยู่แล้ว, ไม่ต้องมีชั้นเพิ่ม) — สร้าง sub-folder
  เฉพาะเมื่อไฟล์เดียวยาวเกิน (ไม่ ceremony ล่วงหน้า)
- `components/ui/` — shadcn primitives + design-system components (Button, DataTable, FeatureGate,
  QueryStateView, ฯลฯ) — **feature-agnostic, org-agnostic** (ข้อ 1.1.4) reuse ได้โดย back-office
- `lib/` — cross-cutting infra ที่ไม่ใช่ UI: auth transport (มีอยู่แล้ว, ★ อย่าแตะ), `api/` (error taxonomy,
  org-scoped client factory, query-client), `org/` (ActiveOrg context), `session/` (bootstrap state), `format/`

### 2.2 โครงโฟลเดอร์เป้าหมาย

```
apps/web/
├── src/
│   ├── app/                              # App Router — routing/composition เท่านั้น
│   │   ├── layout.tsx                    # RootLayout: html/body + QueryClientProvider + SessionBootstrap + Toaster
│   │   ├── page.tsx                      # "/" → redirect ตาม SessionState (none→/login · authed→/o/[defaultOrg])
│   │   ├── login/page.tsx                # KEEP (F-001 มีแล้ว) — "use client", ไม่ต้อง org
│   │   ├── login/help/page.tsx           # KEEP
│   │   ├── signup/page.tsx               # KEEP
│   │   ├── select-org/page.tsx           # F-002: org list เมื่อยังไม่เลือก org (session authed, no active org)
│   │   └── o/
│   │       └── [orgId]/
│   │           ├── layout.tsx            # ★ ActiveOrgProvider + OrgGuard + AppShell (nav/org-switcher)
│   │           ├── dashboard/page.tsx    # F-030
│   │           ├── products/
│   │           │   ├── layout.tsx        # <RouteGuard requiredCapability="manage_products">
│   │           │   ├── page.tsx          # → features/products ProductListScreen
│   │           │   └── [skuId]/page.tsx
│   │           ├── stock/…               # F-011/13/14
│   │           ├── channels/
│   │           │   ├── page.tsx          # F-020/22/27/29
│   │           │   └── callback/page.tsx # OAuth popup callback (postMessage + close, §3.8)
│   │           ├── orders/…              # F-024/26/50
│   │           ├── documents/…           # F-040/42 (FeatureGate feature="accounting")
│   │           ├── reports/…             # F-031/41/43
│   │           ├── bulk/…                # F-092
│   │           └── settings/
│   │               ├── security/page.tsx # KEEP (F-001 SecuritySettingsPage, ย้ายเข้ามาใต้ org ตอน F-002)
│   │               └── org/page.tsx      # F-004
│   ├── features/
│   │   ├── auth/                         # ★ exemplar — REFACTOR ปลายทางของ components/auth/ ปัจจุบัน (§6)
│   │   │   ├── api/                      # (ว่าง — F-001 ใช้ lib/auth-client.ts ตรง ๆ, ไม่ org-scoped)
│   │   │   ├── components/               # AuthForm, ChangePasswordForm, SessionList, SessionListItem
│   │   │   └── i18n.ts                   # authTh (ย้ายจาก src/i18n/auth.ts)
│   │   ├── org/                          # F-002: org list/switcher/invite
│   │   ├── products/                     # F-010/12
│   │   │   ├── api/use-products.ts, use-create-product.ts, …
│   │   │   ├── components/ProductListScreen.tsx, ProductForm.tsx
│   │   │   ├── forms/product-form-schema.ts
│   │   │   └── columns/product-columns.tsx
│   │   ├── stock/                        # F-011/13/14
│   │   ├── channels/                     # F-020/21/22/29 (OAuth + import + mapping + price)
│   │   ├── orders/                       # F-024/26/50
│   │   ├── documents/                    # F-040/42
│   │   ├── reports/                      # F-031/41/43
│   │   ├── bulk/                         # F-092 (job polling UI)
│   │   └── settings/                     # F-004/004b
│   ├── components/
│   │   └── ui/                           # design-system, feature-agnostic (KEEP + โต)
│   │       ├── Button.tsx, TextField.tsx, PasswordField.tsx, ConfirmDialog.tsx,
│   │       │   ErrorBanner.tsx, Skeleton.tsx, Toast.tsx, ThrottleBanner.tsx, AuthCard.tsx   # KEEP (มีแล้ว)
│   │       ├── EmptyState.tsx            # ADD — ตัวที่ 4 ของ 4-states ที่ยังไม่มี component กลาง
│   │       ├── QueryStateView.tsx        # ADD — web's AsyncStateView (§3.1)
│   │       ├── FeatureGate.tsx           # ADD (§3.3)
│   │       ├── JobStatusBanner.tsx       # ADD (§3.7)
│   │       ├── data-table/               # ADD (§3.5): DataTable.tsx, BulkActionBar.tsx, use-url-table-state.ts
│   │       ├── form/                     # ADD (§3.6): FormField.tsx (shadcn Form + RHF wiring)
│   │       └── utils.ts                  # KEEP (cn() helper)
│   ├── lib/                              # cross-cutting infra — ★ ส่วนความปลอดภัยห้ามแตะโดยไม่มี review
│   │   ├── auth-client.ts, csrf.ts, token-store.ts, api-base.ts,
│   │   │   error-messages.ts, validation.ts, relative-time.ts,
│   │   │   session-expired-redirect.ts, throttle-countdown.ts    # ★ KEEP verbatim (client-security reviewed)
│   │   ├── api/
│   │   │   ├── error.ts                  # ADD — ApiFailure (generalize error-messages.ts, §3.4)
│   │   │   ├── org-client.ts             # ADD — org-scoped contracts client factory (§3.2)
│   │   │   └── query-client.ts           # ADD — QueryClient factory + defaultOptions
│   │   ├── org/
│   │   │   └── org-context.tsx           # ADD — ActiveOrg context + useActiveOrg/useCan/useEntitled (§3.2, §3.3)
│   │   ├── session/
│   │   │   └── session-state.ts          # ADD — SessionState (unknown|none|authed), bootstrap (§3.1 note)
│   │   └── format/                       # ADD — เงิน/วันที่/จำนวนแบบไทย (display เท่านั้น, §3.6/§4.3)
│   ├── i18n/                             # ต่อ feature (มีแล้ว auth.ts) — ADD runtime i18n lib เมื่อสเกลถึง (§6)
│   ├── hooks/                            # cross-cutting hooks: use-throttle-countdown (มีแล้ว), use-job-polling (ADD)
│   ├── styles/                           # tokens.css, globals.css — KEEP
│   └── test-setup/                       # KEEP + เติม renderWithProviders (§5)
├── tool/
│   └── check-boundaries.mjs              # ADD — boundary gate, ใช้ dependency-cruiser (reuse-first, มีอยู่แล้วฝั่ง core-domain)
├── next.config.mjs                       # KEEP
├── vitest.config.ts                      # KEEP + เพิ่ม test wrapper import
└── tsconfig.json                         # KEEP
```

### 2.3 Dependency rules (บังคับด้วย dependency-cruiser — ดู §5.2)

```
app/**  ──►  features/*  +  components/ui/**  +  lib/**      (composition only, ★ ทางเดียวที่ import features ได้)
features/<f>/**  ──►  components/ui/**  +  lib/**  +  hooks/**      (ห้าม import features/<g>/** อื่น)
features/<f>/api/**  ──►  @omnistock/contracts  +  lib/api/**        (ที่เดียวใน feature ที่แตะ generated client)
components/ui/**  ──►  lib/format/**, lib/utils   (ห้าม import features/** หรือ lib/api|org|session/**)
lib/**  ──►  (leaf — ห้าม import features/** หรือ components/**)
```

1. `app/**` import ได้เฉพาะ `features/*` (default export ของ screen component) + `components/ui/**` +
   `lib/**` — ไฟล์ใต้ `app/` ห้ามมี `useQuery`/`fetch`/business logic ของตัวเอง (composition only)
2. `features/<f>/**` ห้าม import `features/<g>/**` อื่น — ข้าม feature ทำได้ 2 ทางเท่านั้น: (ก) navigation
   (`<Link href="/o/[orgId]/orders">`) (ข) query cache invalidation ผ่าน shared query key namespace
   (เทียบเท่า mobile's event bus — §3.7) ไม่มี "import feature อื่นมาเรียก hook ตรง ๆ"
3. `@omnistock/contracts` (generated client) import ได้เฉพาะ `features/*/api/**` + `lib/api/**` — ไฟล์
   `components/`/`forms/` ของ feature ห้ามยิง fetch เอง ต้องผ่าน hook ใน `api/`
4. `components/ui/**` ห้าม import `features/**`, `lib/api/**`, `lib/org/**`, `lib/session/**` — คง
   feature-agnostic + org-agnostic (ตอบ back-office reuse, ข้อ 1.1.4) — import ได้แค่ `lib/format/**`
   (การ format ไม่ผูก org) และ `lib/utils`
5. `lib/**` ห้าม import `features/**` หรือ `components/**` — เป็น leaf layer เสมอ (เหมือนที่ auth-client.ts
   เป็นอยู่แล้ว วันนี้)
6. **org-scoped client ต้องมาจาก `lib/org/org-context.tsx` เท่านั้น** — ไม่มี feature ไหนสร้าง API client
   เองตรง ๆ (เทียบ mobile rule "generated client แตะได้เฉพาะ data/+core/api") — บังคับด้วย rule 3 + review
   (dependency-cruiser เช็ค import path ได้ แต่เช็ค "เรียก client ถูกวิธี" ไม่ได้ — ส่วนนี้เป็น convention +
   code review, เหมือนที่ mobile เองก็ยอมรับว่า rule 7 บางส่วนเป็น convention)

---

## §3 Key patterns (พร้อม code sketch)

### 3.1 Server vs Client component — auth transport บังคับคำตอบ (ไม่ใช่ preference)

เทียบ 3 ทางเลือกจากศูนย์ **โดยเอา D-019 (access token in-memory, refresh cookie `Path=/auth` เท่านั้น)
เป็นข้อเท็จจริงตั้งต้น**:

| ทางเลือก | เข้ากับ auth transport ไหม | ตัดสิน |
|---|---|---|
| **RSC-heavy** (fetch org data ใน Server Component ด้วย access token) | **ทำไม่ได้จริง** — access token อยู่ใน browser JS memory เท่านั้น (client-security invariant); RSC รันบน Node process ไม่มีทางเห็นค่านั้น การจะทำให้ RSC fetch ได้ต้องสร้าง server-side session แยก (เช่น อ่าน `omni_rt` แล้ว refresh เองทุก request) ซึ่ง **ขัด D-019 โดยตรง** (เพิ่ม auth code path ที่สอง server+client) และเพิ่ม latency ทุก navigation | ปฏิเสธ |
| **Client-fetch-heavy** (Client Component + TanStack Query ทุกจอที่มีข้อมูล org) | ตรงกับที่ credential อยู่จริง (browser) — auth code path เดียว | **เลือกสำหรับทุกจอใต้ `/o/[orgId]/**`** |
| **Hybrid: RSC เฉพาะที่ไม่ต้อง auth data** | shell chrome/static text ไม่ต้องรู้ org data เลย → เป็น RSC ได้ (bundle เล็กลง, paint เร็วขึ้น) แต่เนื้อจอ (ตาราง/ฟอร์ม) ยังต้อง client | **เลือกเป็น posture รวม**: RSC เฉพาะ `login`/`signup`/marketing/static layout chrome; ทุกอย่างที่อ่าน/เขียนข้อมูล org = Client Component |

**ผลที่ตามมาอีกข้อที่ต้องพูดตรง ๆ (middleware ทำ auth gate ไม่ได้):** Next.js middleware รันก่อน client JS
และ *เห็น* cookie header ได้ (ต่างจาก JS ฝั่ง browser) — แต่ปัญหาคือ `omni_rt` ถูก scope **`Path=/auth`**
(D-019, C-1) โดยตั้งใจ **เพื่อไม่ให้ถูกส่งไปกับ request อื่นเลย** — แปลว่า request ไปที่ `/o/org_1/dashboard`
เบราว์เซอร์จะไม่แนบ `omni_rt` มาด้วยตั้งแต่ต้น ไม่ว่า middleware จะอยากอ่านแค่ไหน เราจะ**ไม่เสนอขยาย path
ของ `omni_rt`** (จะย้อน C-1 ที่ security review ล็อกไว้ด้วยเหตุผลเฉพาะ — ต่างจาก `omni_csrf` ที่ D-019
ขยายแล้วเพราะไม่มี secret) → **สรุป: ไม่มี middleware-based auth gate ได้เลย บน stack นี้** ต้อง gate
ที่ client component หลังจาก JS โหลดเท่านั้น (เหมือน mobile's `SessionUnknown` bootstrap state):

```ts
// lib/session/session-state.ts
export type SessionState =
  | { status: "unknown" }                       // bootstrap silent-refresh ยังไม่จบ
  | { status: "none" }                           // ไม่ได้ล็อกอิน
  | { status: "authed"; orgs: OrgSummary[] };    // ล็อกอินแล้ว — org list มาจาก F-002

// app/layout.tsx (RootLayout) — SessionBootstrap ครอบทั้งแอปครั้งเดียว
// ทำ silentRefresh() หนึ่งครั้งตอน mount (เหมือนมือถือ "cold-start restore")
// ระหว่างนั้น render skeleton เต็มจอ (ไม่ flash ของเก่า/หน้าเปล่า)
```

ผลที่ตามมา: deep-link ตรงไปที่ `/o/x/products` ของคนที่ไม่ได้ล็อกอิน จะเห็น skeleton สั้น ๆ ก่อน redirect
ไป `/login` แทนที่จะถูกกันตั้งแต่ edge — **ยอมรับ trade-off นี้อย่างรู้ตัว** เพราะเป็นผลของการ scope
cookie ให้แคบสุดตาม security review (ไม่ใช่ gap ที่ลืมทำ)

**Data fetching layer: TanStack Query (v5)** เทียบ SWR / เขียนเอง:

| เกณฑ์ | TanStack Query (เลือก) | SWR | เขียนเอง |
|---|---|---|---|
| Mutation + cache invalidation ที่ซับซ้อน (org switch, bulk action, job polling) | `useMutation` + `invalidateQueries` โดย query-key prefix — ตรงกับ pattern org-scoped ที่ต้องการ | mutation เป็น pattern เสริม ไม่ใช่ core API — ต้องประกอบเอง | ต้องสร้างใหม่หมด ต้นทุนสูงกับ 40+ features |
| Infinite/paginated query (data table) | `useInfiniteQuery`/manual pagination key มีในตัว | มีแต่บาง | ไม่มี |
| DevTools + retry/backoff policy | มีในตัว, ปรับ per-query ได้ | มีบางส่วน | ต้องเขียน |
| ต้นทุน dependency ใหม่ | 1 dependency (new-dep gate) แต่ผลตอบแทนสูงสุดในบรรดา 3 ตัวเลือกสำหรับ backlog ระดับนี้ | เช่นกัน แต่ ROI ต่ำกว่าเพราะ mutation ergonomics อ่อนกว่า | ไม่มี dependency แต่ราคาซ่อนอยู่ที่ maintenance ของทุก feature |

### 3.2 Org scoping: org ใน URL + org-scoped query client — B1/D5 ที่ระดับโครง ไม่ใช่วินัย

**คำถามจาก design-brief:** org อยู่ URL หรือ client state? 2 tab 2 org ได้ไหม?

**เทียบ:**
- (ก) org เป็น **global client state** (Zustand/Context เดียวทั้งแอป ไม่อยู่ URL) — deep-link ไม่ได้ (แชร์
  ลิงก์ `/products` แล้วเปิดคนละ org ไม่รู้), 2 tab บังคับ sync กัน (เปลี่ยน org tab หนึ่งกระทบอีก tab ถ้า
  ใช้ localStorage, หรือคนละ state ถ้าไม่ sync — สับสนทั้งคู่) → ตกรอบ
- **(ข — เลือก) org เป็นส่วนของ URL** (`/o/[orgId]/...`) — deep-linkable (แชร์ URL ได้ตรงเป๊ะ), 2 tab
  2 org ได้ธรรมชาติ (คนละ URL คนละ React tree คนละ query cache instance) โดยไม่ต้องออกแบบ sync logic
  ใด ๆ — ตรงกับพฤติกรรมจริงของ browser tab อยู่แล้ว (ต่างจาก mobile ที่มี instance เดียว ต้องมี
  `activeOrgIdProvider` แบบ global เพราะไม่มี "URL ต่อหน้าจอ" concept)

```tsx
// lib/org/org-context.tsx
const ActiveOrgContext = createContext<ActiveOrg | null>(null);

export function ActiveOrgProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  // capabilities + entitlements ต่อ org (F-002/F-003/F-007) — query key มี orgId เป็น namespace เสมอ
  const { data, isPending, isError } = useOrgMembership(orgId);
  if (isPending) return <AppShellSkeleton />;
  if (isError || !data) return <OrgAccessDenied />;         // 403/404 → ไม่ใช่ org ของ user นี้
  return (
    <ActiveOrgContext.Provider value={{ orgId, capabilities: data.capabilities, entitlements: data.entitlements }}>
      {children}
    </ActiveOrgContext.Provider>
  );
}

export function useActiveOrg(): ActiveOrg {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) throw new Error("useActiveOrg ถูกเรียกนอก /o/[orgId] — route นี้ไม่ควร render component นี้");
  return ctx;
}
```

```ts
// lib/api/org-client.ts — เทียบ mobile's orgDioProvider (ทุก feature ต้องผ่านทางนี้เท่านั้น)
export function useOrgApiClient() {
  const { orgId } = useActiveOrg();                          // ← หัวใจ: derive จาก URL/context เชิงโครงสร้าง
  return useMemo(() => createContractsClient(API_BASE, {
    headers: () => ({
      Authorization: `Bearer ${getAccessToken()}`,
      "X-Organization-Id": orgId,
    }),
  }), [orgId]);
}
```

```ts
// features/stock/api/use-stock-items.ts — query key namespaced ด้วย orgId เสมอ (convention บังคับด้วย
// code review + test — TypeScript บังคับ "ต้องมี orgId ใน key" ตรง ๆ ไม่ได้ เหมือนที่ mobile ก็ยอมรับ
// rule 7 บางส่วนเป็น convention ไม่ใช่ compiler-level)
export function useStockItems(params: StockListParams) {
  const client = useOrgApiClient();
  const { orgId } = useActiveOrg();
  return useQuery({
    queryKey: ["stock-items", orgId, params],
    queryFn: () => client.GET("/stock-items", { params: { query: params } }),
  });
}
```

**ผลลัพธ์ตรงคำถาม design-brief:**
1. **org switch = navigation** — `OrgSwitcher` เปลี่ยน path (`/o/org_1/products` → `/o/org_2/products`)
   ไม่ mutate state — React remount `ActiveOrgProvider` ใหม่ทั้งต้น, query key เปลี่ยน (`orgId` เปลี่ยน) →
   cache เก่าไม่มีทาง "รั่ว" มาแสดงเพราะไม่มี query ไหน key ตรงกับ org ใหม่เลย (เทียบ mobile's autoDispose:
   ที่นี่ "ไม่มีใคร query ผิด org" แทนที่จะ "cache ถูกฆ่า" — ผลลัพธ์ safety เดียวกัน)
2. **2 tab 2 org ได้ฟรี** — แต่ละ tab คือ browser context แยก: `token-store.ts` เป็น module-level variable
   ต่อ JS heap (คนละ tab คนละ heap), `QueryClient` สร้างครั้งเดียวใน `RootLayout` ต่อ page load (คนละ tab
   คนละ instance) — ไม่มี cross-tab state sharing โดยไม่ตั้งใจอยู่แล้ว จาก transport ที่ล็อกไว้ตั้งแต่ F-001

### 3.3 Declarative gating: `FeatureGate` (tier) + `useCan` (RBAC) — เหมือน mobile แต่ต่างที่ route layer

```tsx
// components/ui/FeatureGate.tsx — design-system §5: tier ไม่มี → โชว์+ล็อก+ปุ่มอัปเกรด (ห้ามซ่อน)
export function FeatureGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { entitlements } = useActiveOrg();
  if (!entitlements.has(feature)) return <UpgradeLockedPanel feature={feature} />;
  return <>{children}</>;
}

// lib/org/org-context.tsx (เพิ่ม)
export function useCan(capability: string): boolean {
  return useActiveOrg().capabilities.has(capability);       // B3 — RBAC, คนละ context field จาก B2
}
```

Next.js App Router **ไม่มี declarative route-metadata guard แบบ go_router's `redirect`** — ทางเลือกที่
เทียบ: (ก) middleware — ตัดแล้วใน §3.1 (มองไม่เห็น session เลย) (ข) **`<RouteGuard>` wrapper ต่อ
route-segment `layout.tsx`** (เลือก) — ไม่ compiler-enforced เท่า mobile's sealed redirect chain แต่เป็น
mechanical convention เดียวกันทุก route จึง lint ด้วย custom rule ได้ (§5.2):

```tsx
// app/o/[orgId]/products/layout.tsx
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return <RouteGuard requiredCapability="manage_products">{children}</RouteGuard>;
}

// components/ui/RouteGuard.tsx
export function RouteGuard({ requiredCapability, children }: { requiredCapability: string; children: ReactNode }) {
  const can = useCan(requiredCapability);
  if (!can) return <ForbiddenPanel />;      // ไม่ redirect loop — เหมือน mobile: server enforce เสมอ, client = UX
  return <>{children}</>;
}
```

client ซ่อน/ล็อกเป็น UX เท่านั้น — **server enforce เสมอ** (403 จาก server → `ForbiddenFailure` → §3.4)

### 3.4 Error taxonomy: `ApiFailure` discriminated union (generalize จาก `ApiError`/`error-messages.ts` ปัจจุบัน)

```ts
// lib/api/error.ts
export type ApiFailure =
  | { kind: "network" }
  | { kind: "throttled"; retryAfterSeconds: number }
  | { kind: "auth-expired" }                                  // silent-refresh + retry-once ล้มเหลว (ตรงกับ SessionExpiredError วันนี้)
  | { kind: "forbidden"; code?: string }                       // 403 RBAC
  | { kind: "entitlement"; feature?: string }                  // 403 tier — CTA อัปเกรด
  | { kind: "validation"; code?: string; fieldErrors: Record<string, string> }
  | { kind: "conflict"; code?: string }                        // 409 — เช่น เลขรันเอกสารชน
  | { kind: "not-found" }
  | { kind: "server" };

export function toApiFailure(err: unknown): ApiFailure { /* จาก ApiError/SessionExpiredError/network throw */ }

// central Thai mapping — เก็บ pattern เดิมของ error-messages.ts (i18n key, ห้าม render raw code)
// แต่ทำ generic ไม่ผูก auth feature เดียว; feature เติม mapping เฉพาะทางซ้อนบนได้ (เหมือน auth 401 พิเศษวันนี้)
export function failureMessage(f: ApiFailure): string { /* switch ครบทุก kind (TS exhaustiveness check) */ }
```

`error-messages.ts` วันนี้ (signup/login/changePassword-specific switch) **ไม่ทิ้ง** — กลายเป็น layer
เฉพาะทางที่ซ้อนบน fallback กลางนี้ พอดีกับที่ auth-client.ts มี `isChangePasswordAuthExpiry` แยกอยู่แล้ว
(pattern เดิมถูกต้อง แค่ยังไม่ generalize ให้ feature อื่นใช้ต่อ)

### 3.5 Heavy-table infra: หนึ่ง `DataTable` pattern (D3)

เทียบ TanStack Table (headless) vs AG Grid vs เขียนเอง:

| เกณฑ์ | **TanStack Table + shadcn** (เลือก) | AG Grid | เขียนเอง |
|---|---|---|---|
| เข้ากับ design tokens/Tailwind | headless — เราคุม markup 100% ด้วย Tailwind utility ที่ผูก token อยู่แล้ว (D-020) | มี styling system ของตัวเอง ชนกับ token ที่ ux ควบคุม, ต้อง override CSS หนัก | คุมได้เต็มที่แต่ไม่ reuse |
| bundle/license | เบา, MIT | หนักกว่ามาก, ฟีเจอร์ระดับ enterprise (row grouping) เป็น commercial license ที่ backlog ยังไม่ต้องการ | เบาสุดแต่ราคาซ่อนที่ maintenance |
| Reuse ต่อจอ (สินค้า/ออเดอร์/เอกสาร ฯลฯ ~15+ จอ) | pattern เดียวคุม pagination/sort/filter/bulk-select ผ่าน generic component | เช่นกันแต่ราคาสูงกว่าโดยไม่ได้อะไรเพิ่มที่ backlog ต้องการ | ต้องเขียนซ้ำทุกจอถ้าไม่ทำ generic เอง |

```tsx
// components/ui/data-table/DataTable.tsx — generic, feature-agnostic
export function DataTable<T>({
  columns, data, pageCount, state, onStateChange, bulkActions, rowCount,
}: DataTableProps<T>) {
  const table = useReactTable({ columns, data, pageCount, state, onStateChange, manualPagination: true,
    manualSorting: true, manualFiltering: true, getCoreRowModel: getCoreRowModel() });
  const shouldVirtualize = rowCount > 200;                     // threshold: paginated views (25-50/page) ไม่ virtualize
  return shouldVirtualize ? <VirtualizedTableBody table={table} /> : <PlainTableBody table={table} />;
}

// use-url-table-state.ts — ?page=&sort=&q=&filter[status]= ผ่าน useSearchParams (ไม่ใช่ client state ล้วน)
// เหตุผล: งาน admin หนัก user แชร์ URL ตารางที่กรองแล้วให้เพื่อนร่วมทีม / bookmark ได้ — D3 requirement จริง
export function useUrlTableState(defaults: TableStateDefaults) { /* parse+serialize search params, router.replace shallow */ }
```

```tsx
// features/products/components/ProductTable.tsx — จอใหม่เหลือแค่นี้
function ProductTable() {
  const [tableState, setTableState] = useUrlTableState({ sort: "name" });
  const query = useProducts(tableState);                      // features/products/api/use-products.ts
  return (
    <QueryStateView query={query} isEmpty={(d) => d.items.length === 0} empty={<EmptyState cta="เพิ่มสินค้าแรก" />}>
      {(data) => (
        <DataTable columns={productColumns} data={data.items} pageCount={data.pageCount} rowCount={data.total}
          state={tableState} onStateChange={setTableState}
          bulkActions={[{ label: "ลบที่เลือก", onRun: handleBulkDelete }]} />
      )}
    </QueryStateView>
  );
}
```

### 3.6 Form pattern: react-hook-form + zod (D4)

เทียบ Formik: RHF เป็น uncontrolled-first (re-render น้อยกว่ามากบนฟอร์มใหญ่อย่างเอกสารบัญชี), shadcn/ui
`<Form>` primitives (จะเพิ่มเข้า `components/ui/form/`) ผูกกับ RHF+zod อยู่แล้วโดย convention ของ shadcn เอง
(reuse-first ตาม design-system §6 — ไม่ต้องเลือกใหม่)

```ts
// features/products/forms/product-form-schema.ts
export const productFormSchema = z.object({
  code: z.string().min(1, "จำเป็นต้องกรอกรหัสสินค้า"),
  name: z.string().min(1, "จำเป็นต้องกรอกชื่อสินค้า"),
  basePrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "ราคาต้องเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง"),
  // basePrice ยังเป็น string ตลอดสาย — validate "รูปแบบ" ไม่ใช่ "คำนวณ"; ส่ง raw string ให้ server ตัดสินเป็น Decimal (B5)
});
```

```tsx
// features/products/components/ProductForm.tsx
const form = useForm({ resolver: zodResolver(productFormSchema), defaultValues });
const mutation = useCreateProduct();
const isDirty = form.formState.isDirty;
useConfirmNavigation(isDirty);                                 // dirty-state guard — beforeunload + router intercept

async function onSubmit(values: ProductFormValues) {
  try {
    await mutation.mutateAsync(values);
    toast.success("บันทึกสินค้าแล้ว");
  } catch (err) {
    const failure = toApiFailure(err);
    if (failure.kind === "validation") {
      for (const [field, msg] of Object.entries(failure.fieldErrors)) form.setError(field as never, { message: msg });
    } else {
      toast.error(failureMessage(failure));                    // ผู้ใช้ไม่รู้ว่า error มาจาก client หรือ server (เหมือน mobile §3.7)
    }
  }
}
```

**multi-step wizard (F-021 import)**: `<Wizard steps={[...]}>` shell ถือ RHF context เดียว
(`FormProvider`), แต่ละ step ประกาศ zod schema ของตัวเอง validate เฉพาะ field ของ step นั้นก่อนกด "ถัดไป"
— schema รวมทั้งฟอร์ม validate อีกครั้งตอน submit จริง (กัน step ก่อนหน้าถูกแก้ผ่าน browser back)

**เงิน/สต๊อกในฟอร์ม**: ทุก input ที่เป็นจำนวนเงิน/สต๊อกเป็น string/int ธรรมดา ส่ง raw ให้ server ตัดสิน —
**ไม่มี arithmetic บน client แม้แต่ preview/total ชั่วคราว** (แสดง placeholder "คำนวณเมื่อบันทึก" แทนถ้า UX
ต้องการ preview — เป็นคำถามให้ ux ตัดสิน ไม่ใช่ frontend เดาเอง)

### 3.7 Async/long-running jobs: polling (import, bulk CSV, sync push)

เหมือน mobile — **ไม่ทำ WebSocket/SSE ตอนนี้**: backlog ไม่มี requirement hard-realtime, polling +
mutation-invalidation ครอบ D2 ที่ราคาถูกกว่ามาก (seam: ถ้าอนาคตมี stream จริงก็ยิงเข้า query cache
เหมือนเดิม ไม่ต้องเปลี่ยน component)

```ts
// hooks/use-job-polling.ts — ใช้ร่วมกับ F-021 (import), F-092 (bulk CSV), F-023 (sync push status)
export function useJobPolling(jobId: string | null) {
  const client = useOrgApiClient();
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => client.GET("/jobs/{id}", { params: { path: { id: jobId! } } }),
    enabled: !!jobId,
    refetchInterval: (query) => (isTerminalStatus(query.state.data?.status) ? false : 2000),
  });
}
```

```tsx
// components/ui/JobStatusBanner.tsx — progress/skeleton/error/success ผ่าน QueryStateView เดียวกันทุกจอ job
function JobStatusBanner({ jobId }: { jobId: string }) {
  const query = useJobPolling(jobId);
  return <QueryStateView query={query}>{(job) => <ProgressBar status={job.status} percent={job.percent} />}</QueryStateView>;
}
```

**D2 (real-time-ish) โดยรวม**: TanStack Query default `refetchOnWindowFocus: true` ครอบ "กลับมาที่ tab
แล้วเห็นของใหม่" ฟรี · จอที่ freshness สำคัญกว่า (sync health, order list) เพิ่ม `refetchInterval` เฉพาะจอ
(30s ระหว่าง tab focus, หยุดเมื่อ hidden — TanStack Query เคารพ Page Visibility เองอยู่แล้ว) · mutation
สำเร็จ → `invalidateQueries({queryKey: [resource, orgId]})` ให้จอพี่น้อง (เช่น dashboard การ์ดสต๊อกกับจอ
stock list) sync กันทันที — query cache **คือ** event mechanism ในตัว ไม่ต้องมี event bus แยกแบบ mobile
(mobile ต้องมีเพราะ Riverpod ไม่มี "cache" concept ร่วมข้าม controller แบบเดียวกัน)

### 3.8 OAuth connect flow (F-020) — popup + `postMessage`

เทียบ popup vs full-page redirect **โดยเอา bearer-in-memory เป็นข้อเท็จจริงตั้งต้นอีกครั้ง**: full-page
redirect ออกไป Shopee แล้วกลับมา = browser navigation เต็มรูปแบบ → JS heap ถูกทิ้ง → access token
ใน-memory หาย (ต้อง silent-refresh ใหม่ตอนกลับมา — ทำได้เพราะ cookie ยังอยู่ แต่ **state UI อื่นในหน้า
เดิมหายหมด**, เช่นถ้าผู้ใช้กำลังกรอกฟอร์มอื่นค้างอยู่คนละแท็บของ flow เดียวกัน) — popup หลีกเลี่ยงปัญหานี้
เพราะหน้าเดิม (opener) ไม่ navigate เลย:

```ts
// features/channels/api/use-connect-channel.ts
export function useConnectChannel(channelKey: string) {
  const { orgId } = useActiveOrg();
  const qc = useQueryClient();
  return useCallback(() => {
    const popup = window.open(`/o/${orgId}/channels/oauth-start/${channelKey}`, "connect", "width=520,height=680");
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;        // origin check — กัน postMessage ปลอม (client-security)
      if (e.data?.type === "channel-connected" && e.data.orgId === orgId) {
        qc.invalidateQueries({ queryKey: ["channel-accounts", orgId] });
        window.removeEventListener("message", onMessage);
        popup?.close();
      }
    }
    window.addEventListener("message", onMessage);
  }, [channelKey, orgId, qc]);
}
```

`app/o/[orgId]/channels/callback/page.tsx` — จอเดียวหน้าที่เดียว: อ่านผลจาก query string (server
redirect มาที่นี่หลัง exchange token กับ platform เสร็จ) แล้ว `window.opener.postMessage({type:
"channel-connected", orgId}, window.location.origin); window.close();` — จอปลายทาง (channel list) ไม่ต้อง
รู้เรื่อง popup เลย แค่ฟัง query invalidation

**NEEDS_REAUTH**: `ChannelAccount.status` แสดงผ่าน `SyncHealthBadge`/banner component เดียวที่ reuse ทั้ง
channel list และ dashboard — กดแล้ว trigger `useConnectChannel` เดิม (reconnect = connect flow เดิมซ้ำ
ไม่ใช่ flow พิเศษ)

### 3.9 New feature playbook — ตัวอย่าง F-022 (channel listing mapping)

ขั้นตอนที่ agent ทำตามได้โดยไม่ต้องตีความ (mirror mobile §5.3):

```
1. อ่าน spec F-022 + contract (regen ถ้า contract ใหม่: pnpm --filter @omnistock/contracts run gen:contracts:ts)
2. สร้างโครง:
   src/features/channels/
   ├── api/
   │   ├── use-channel-listings.ts        # useQuery — queryKey: ["channel-listings", orgId, params]
   │   └── use-map-listing.ts             # useMutation — invalidate ["channel-listings", orgId] on success
   ├── components/
   │   ├── ListingMappingScreen.tsx       # DataTable + bulk "auto-map" action
   │   └── ListingMappingRow.tsx
   ├── forms/
   │   └── manual-map-schema.ts           # zod — เลือก SellableSku ผูกกับ externalSkuId
   └── columns/
       └── listing-columns.tsx            # TanStack Table column defs

3. เติม i18n copy ใน src/i18n/channels.ts (copy จาก ux — ห้ามแต่งเอง)
4. register:
   src/app/o/[orgId]/channels/mapping/page.tsx   → import + render ListingMappingScreen (1 ไฟล์ใหม่)
   src/app/o/[orgId]/channels/mapping/layout.tsx → <RouteGuard requiredCapability="manage_channels">
   จุดแตะของเก่ามีเท่านี้ (A3) — ไม่แก้ไฟล์ feature อื่น
5. เทสต์ mirror: api/ (MSW mock handler) · components (renderWithProviders, 4 states) · forms (zod schema, pure)
6. รัน: pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test
   && node tool/check-boundaries.mjs → เขียวครบ
7. รายงานผลตามจริง (กฎ CLAUDE.md ข้อ 4)
```

---

## §4 Performance & bundle strategy (D9)

- **RSC/streaming**: จำกัดเฉพาะ `login`/`signup`/`select-org`/static shell chrome (§3.1) — Next.js
  `loading.tsx` ต่อ route segment ให้ streaming skeleton ฟรีระหว่างรอ Client Component ของ feature โหลด
  (ผู้ใช้เห็น app shell ทันที ไม่รอ JS bundle ของทั้งจอ)
- **Bundle split ต่อ route**: heavy libs (`@tanstack/react-table`, PDF viewer สำหรับเอกสารบัญชี, chart
  library สำหรับ dashboard/reports) โหลดผ่าน `next/dynamic({ ssr: false })` เฉพาะ route ที่ใช้จริง —
  App Router แยก JS ต่อ route โดยอัตโนมัติอยู่แล้ว แต่ dynamic import กันไม่ให้ dependency หนักปนเข้า
  shared chunk ของ shell
- **Budget** (วัดด้วย `next build` output + Lighthouse ใน CI ภายหลัง — ตอนนี้เป็นตัวเลขอ้างอิงให้ agent
  ระวัง ไม่ใช่ gate อัตโนมัติจนกว่า devops ต่อ CI job):
  - App shell (layout + auth bootstrap) JS ≤ 150KB gzip
  - ต่อ feature route (นอกเหนือ shell) ≤ 100KB gzip ก่อน dynamic-imported heavy libs
  - ตาราง 1,000+ แถวต่อหน้า (ถ้ามีจอ "แสดงทั้งหมด") ต้อง virtualize (threshold 200 แถว render พร้อมกัน,
    §3.5) — page ปกติ (25-50 แถว) ไม่ต้อง
- **Image**: รูปสินค้า/โลโก้ผ่าน `next/image` เสมอ (lazy + responsive srcset โดย default ของ Next.js) —
  ไม่ hand-roll `<img>` ในจอที่มีรายการเยอะ (product grid)
- **ไม่มี heavy compute บน main thread**: parse/คำนวณหนัก (ถ้ามี) ทำฝั่ง server เสมอ — client เป็นแค่จอ
  แสดงผล (ตรงกับกฎทองอยู่แล้ว จึงแทบไม่มีความเสี่ยงข้อนี้โดยธรรมชาติของ product)

---

## §5 Testing & enforcement

### 5.1 Test ต่อ layer (D-014 — ทุก implementation มีเทสต์ประกบ)

| Layer | วิธี | ห้าม |
|---|---|---|
| `lib/**` (pure fn) | `vitest` ตรง ๆ ไม่ mock (มีอยู่แล้ว: `auth-client.*.test.ts`, `csrf.test.ts`, `validation.test.ts` — pattern นี้ถูกต้อง คงไว้) | เครือข่ายจริง |
| `features/*/api/**` (query hooks) | `renderHook` + `QueryClientProvider` (test `QueryClient`: `retry: false`) + **MSW** (Mock Service Worker) mock ที่ HTTP layer — ไม่ mock `fetch` มือทีละจุดแบบที่ auth-client tests ทำวันนี้ (ADD MSW เมื่อจำนวน hook เยอะขึ้น — F-001 ยังไม่ต้อง) | network จริง |
| `features/*/components/**` | `@testing-library/react` + `renderWithProviders` (wraps `QueryClientProvider` + fake `ActiveOrgProvider`) — บังคับ 4 states ต่อจอ (loading/empty/error/data) ตาม design-system §2 | ยิง network จริง, ไม่ครบ 4 states |
| `features/*/forms/**` (zod schema) | `vitest` ตรง ๆ — schema เป็น pure object, test ได้โดยไม่ต้อง render ฟอร์ม | — |
| `components/ui/**` | เหมือนเดิม (มีอยู่แล้ว: `ConfirmDialog.test.tsx`, `PasswordField.test.tsx`, `ThrottleBanner.test.tsx` — pattern ถูกต้อง คงไว้) | — |
| `app/**` | ไม่ unit-test route wiring เอง (composition-only ตาม §2.1) — coverage มาจาก component test ของ `features/*` ที่ route เรียก + E2E (qa lane, Playwright — นอกขอบเขต frontend) | ใส่ logic ใน `app/` แล้วไม่มีเทสต์คลุม |

### 5.2 Boundary gate: dependency-cruiser (reuse-first — มีอยู่แล้วฝั่ง `packages/core-domain`, §2.5 D-002)

ไม่เสนอ custom Node script ใหม่ (ต่างจาก mobile ที่ไม่มี dependency-cruiser ใน ecosystem Dart) —
`apps/web` เป็น TypeScript อยู่แล้วในระบบเดียวกับที่ `packages/config/depcruise/.dependency-cruiser.cjs`
ใช้คุม core-domain purity — เพิ่ม config set ที่สองเฉพาะ `apps/web` (`forbidden` rules ตาม §2.3):

```js
// apps/web/tool/check-boundaries.mjs (config เฉพาะ web, ต่อ pattern เดียวกับ packages/config/depcruise)
module.exports = {
  forbidden: [
    { name: "app-composition-only", from: { path: "^src/app" },
      to: { path: "^src/lib/api|^src/lib/org" }, /* app/ ต้องผ่าน features/*, ห้ามแตะ lib/api|org ตรง ๆ */ },
    { name: "no-cross-feature-import", from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/(?!\\1/)" } },
    { name: "contracts-client-scoped", from: { path: "^src/(?!features/[^/]+/api|lib/api)" },
      to: { path: "^@omnistock/contracts" } },
    { name: "ui-is-feature-agnostic", from: { path: "^src/components/ui" },
      to: { path: "^src/features|^src/lib/api|^src/lib/org|^src/lib/session" } },
    { name: "lib-is-leaf", from: { path: "^src/lib" }, to: { path: "^src/features|^src/components" } },
  ],
};
```

CI ต่อเข้า `depcruise` job ที่มีอยู่แล้ว (`.github/workflows/ci.yml`) เป็น step ใหม่ `pnpm --filter web
run depcruise` — ตาม pattern เดียวกับที่ core-domain purity gate ทำอยู่ (AC9) ไม่ใช่ CI concept ใหม่

**test-presence check**: เพิ่ม script เล็ก (Node) เช็คว่าทุก `src/features/<f>/` มีไฟล์ `*.test.ts(x)`
อย่างน้อย 1 ไฟล์ต่อ `api/`/`components/`/`forms/` sub-folder ที่มีไฟล์ implementation — กัน "feature ไม่มี
เทสต์" หลุด merge (เหมือน mobile §5.2)

### 5.3 CI job ที่เพิ่ม (ต่อยอด `ci.yml` เดิม ไม่ใช่ pipeline ใหม่)

- `web-boundaries` (ใหม่): `pnpm --filter web run depcruise` — คู่ขนานกับ `depcruise` job เดิม (core-domain)
- `contracts-drift` (มีอยู่แล้ว): ครอบ `pnpm turbo typecheck --filter=web` อยู่แล้ว — ไม่ต้องแก้
- vitest job ที่มีอยู่แล้ว (`pnpm --filter web test`) — เพิ่ม MSW setup file เมื่อ `features/*/api` เริ่มมี
  ไฟล์จริง (F-010+)

---

## §6 Gap analysis vs โค้ดจริง (F-001 auth = feature เดียวที่ build แล้ว)

ภาพรวมที่ต้องพูดตรง ๆ เหมือนที่ mobile.md ทำ: **D-020 (Tailwind+shadcn migration) + auth transport
(D-019, client-security reviewed) คือของจริงคุณภาพสูง ไม่ต้อง rebuild อะไรเลย** — ช่องว่างทั้งหมดคือ
**ชั้นที่ยังไม่ถูกสร้าง** (feature-first structure, org context, data fetching layer, table/form infra)
เพราะ F-001 เป็น feature เดียวที่มี (ไม่มี org, ไม่มี list, ไม่มี heavy form) ไม่ใช่เพราะเลือกผิดทาง —
**ไม่มีรายการ REBUILD**

| Area | สภาพปัจจุบัน | Verdict | เหตุผล | Effort |
|---|---|---|---|---|
| `lib/auth-client.ts`, `csrf.ts`, `token-store.ts`, `api-base.ts` | ★ client-security reviewed, single-flight refresh, retry-once, enumeration-safe, session-expired funnel เดียว | **KEEP verbatim** | ตรง design จากศูนย์ (§3.1) — ทำงานถูกต้องแล้ว, อย่าแตะโดยไม่มี security review ใหม่ | — |
| `next.config.mjs` (dev proxy `/auth/*` + `/api/*`) | รองรับ cookie path scoping ถูกต้องตาม D-019 | **KEEP** | ตรง §3.1 finding (cookie path ต้อง same-origin ตรง path) | — |
| Tailwind v4 + shadcn (`components/ui/*`, `styles/tokens.css`) | D-020 migration เสร็จ, token 1:1 กับ design-system, 17 test files/121 tests green | **KEEP + โต** | ตรง §2.2 (`components/ui/` เป็น design-system layer ที่ต้องการอยู่แล้ว) — เติม `EmptyState`, `QueryStateView`, `FeatureGate`, `RouteGuard`, `JobStatusBanner`, `data-table/`, `form/` ตาม feature ที่มาถึง | S/feature |
| `error-messages.ts` (F-001-specific switch) | mapping ตรงเฉพาะ signup/login/changePassword code | **REFACTOR → ADD** | generalize เป็น `ApiFailure` กลาง (§3.4); ของเดิมกลายเป็น layer เฉพาะทางซ้อนบน fallback กลาง — ทำก่อน F-010 (จอแรกที่ไม่ใช่ auth) ไม่งั้น per-feature-error-type ถูกลอกเหมือน mobile เจอ | M |
| `components/auth/*` (AuthForm, ChangePasswordForm, SessionList, SessionListItem) แบบ flat | ทำงานถูก ครบ 4 states, มี optimistic UX ที่ปลอดภัย (logout device) | **REFACTOR (ย้ายที่)** | ย้ายเข้า `features/auth/components/` ตอนแตะ F-002 (org switcher เข้ามาอยู่ข้าง ๆ) — mechanical move ไม่ใช่ rewrite, ไม่ใช่งานด่วน (ไม่บล็อกอะไรตอนนี้) | S |
| `src/i18n/auth.ts` (const object) | ไทยล้วน ไม่มี runtime switch | **KEEP ชั่วคราว → ADD lib จริงก่อนสเกล** | ต่างจาก mobile ตรงที่ web ยังไม่มี AC บังคับสลับภาษา runtime — แต่ 40+ features จะผลิต copy จำนวนมาก, const-object แบบ static import ยังพอไหวถึง ~5 features ก่อนจะเริ่มปวดหัวเรื่อง organize; แนะนำ evaluate `next-intl` ตอน F-010 (จอที่ 2 ที่ไม่ใช่ auth) ไม่ใช่รอจนสาย | M (ตอนถึงจุดนั้น) |
| Data fetching (`SessionList` ใช้ manual `useState`+`useEffect`) | ทำงานถูก, ครบ 4 states, แต่ pattern นี้ไม่ scale ไป 40+ จอ (loading/error state ต้องเขียนมือทุกจอ) | **ADD (TanStack Query) — ไม่บังคับ migrate ของเดิม** | F-001 เสร็จแล้วและทำงานถูก ไม่คุ้มแก้ตอนนี้; แต่ทุก feature ใหม่ (F-010+) ต้องใช้ TanStack Query ตั้งแต่แรก ไม่ใช่ pattern manual นี้ (§3.1) | L (infra ครั้งแรก) |
| Org/session context (`lib/org/`, `lib/session/`) | ไม่มี (ไม่มี org จนกว่า F-002) | **ADD** | ฐานของ B1/B2/B3/D5 — สร้างพร้อม F-002 (§3.2) | L (F-002/F-007) |
| Route guard (`RouteGuard`, `FeatureGate`) | ไม่มี | **ADD** | ต้องมีก่อนจอ operational แรกที่ gate ด้วย capability/tier (F-003/F-007) | M |
| Data-table infra (`components/ui/data-table/`) | ไม่มี | **ADD** | D3 — ต้องมาพร้อมจอ list แรกที่ไม่ใช่ session list (F-010 product list) | M (F-010 Gate 2) |
| Form infra (RHF+zod, `components/ui/form/`) | ไม่มี (auth forms เป็น controlled `useState` มือ — ใช้ได้เพราะฟอร์มเล็ก 2 field) | **ADD** | D4 — จำเป็นตั้งแต่ฟอร์มที่ 2 ที่ใหญ่กว่า (product form มีหลาย field + validation ซับซ้อนกว่า email/password) | M (F-010) |
| Job polling (`hooks/use-job-polling.ts`, `JobStatusBanner`) | ไม่มี | **ADD** | ต้องมีตอน F-021 (import) เป็นตัวแรกที่ใช้จริง | S (พร้อม TanStack Query) |
| OAuth popup flow (`features/channels/`) | ไม่มี | **ADD** | F-020 เป็นตัวแรก — ดู §3.8 | M (F-020) |
| Boundary gate (`tool/check-boundaries.mjs`) | ไม่มี | **ADD** | reuse dependency-cruiser ที่มีอยู่แล้วในระบบ (§5.2) — ควรมีก่อน feature ที่สอง (F-002) ไม่ใช่รอจน drift เกิดจริง | S |
| `apps/web/CLAUDE.md` | สั้น/placeholder-era, ยังอ้างอิงแค่ flat `src/app/` + `lib/` | **REFACTOR** | ต้อง rewrite ตาม §7 ก่อน feature ถัดไปเริ่ม ไม่งั้น agent รุ่นถัดไปจะสร้างโครง flat ต่อ (เหมือนที่ mobile เจอกับ D-023 ก่อนแก้) | S |
| `vitest.config.ts`, `tsconfig.json`, `package.json` scripts | ตรง spec (jsdom, D-014 `--passWithNoTests`) | **KEEP** | ไม่มีปัญหา — เพิ่มเฉพาะ MSW setup file เมื่อถึงเวลา | — |
| `packages/contracts` client wrapper (`createContractsClient`) | thin wrapper บน `openapi-fetch`, ใช้ได้กับทั้ง API/web | **KEEP** | ตรง E1 (generated client ทางเดียว) — org-scoped wrapper (§3.2) ประกอบเพิ่มจากตัวนี้ ไม่ต้องแก้ตัวเดิม | — |

**ลำดับปิด gap ที่แนะนำ (ผูกกับ backlog เดิม ไม่สร้าง phase ใหม่ — web track resume หลัง mobile MVP):**
1. **ก่อนแตะ F-002/F-010 (จุด restart ของ web track)**: rewrite `apps/web/CLAUDE.md` (§7), เพิ่ม
   `tool/check-boundaries.mjs`, ตั้ง TanStack Query (`lib/api/query-client.ts`), generalize `ApiFailure`
   (§3.4) — งานเตรียมพื้นที่ก่อน feature แรกของรอบใหม่
2. **F-002 (org/license/membership)**: `lib/org/org-context.tsx`, `lib/session/session-state.ts`,
   `app/o/[orgId]/layout.tsx`, ย้าย `components/auth/*` → `features/auth/`
3. **F-003/F-007 (RBAC/entitlements)**: `RouteGuard`, `FeatureGate` เต็มรูป
4. **F-010 (product/SKU — จอ list+form แรกที่ไม่ใช่ auth)**: `components/ui/data-table/`,
   `components/ui/form/`, i18n library evaluation
5. **F-020/021 (OAuth + import)**: popup flow (§3.8), job polling (§3.7)
6. **F-092 (bulk CSV)**: bulk action bar เต็มรูปใน `DataTable`

---

## §7 ร่าง guideline สำหรับ `apps/web/CLAUDE.md` (ให้ build agent ใช้แทนการอ่านเอกสารนี้ทั้งฉบับ)

> เนื้อหาด้านล่างคือ **ร่างที่จะไปแทนที่ apps/web/CLAUDE.md ปัจจุบัน** ตอน web track resume (F-002+)
> — ห้าม copy ไปก่อนของจริงมี (`lib/api/`, `lib/org/`, `features/`, `tool/check-boundaries.mjs` ต้องถูก
> สร้างจริงก่อน) กติกาต้องตรงกับโค้ด ไม่ใช่ความหวัง · ส่วน stack/คำสั่งของเดิมคงไว้

```markdown
## โครงสร้าง (อ่าน docs/architecture/web.md เมื่อสงสัยเหตุผล)

- feature ใหม่ = โฟลเดอร์ใหม่ใต้ src/features/<f>/: api/ (TanStack Query hooks — ที่เดียวที่แตะ
  generated client) · components/ (screen + widget) · forms/ (zod schema) · columns/ (data-table)
- src/app/ = routing เท่านั้น — ต้อง import component จาก features/*, ห้ามมี useQuery/fetch/logic เอง
- exemplar: features/auth/ (หลัง F-002 ย้ายจาก components/auth/ เข้ามา) · playbook เต็ม:
  docs/architecture/web.md §3.9
- จุด register ของ feature มี 2 ที่: src/app/o/[orgId]/<f>/page.tsx (route) · src/i18n/<f>.ts (copy)

## กฎเหล็ก (boundary gate จับ — รันก่อนส่งงานเสมอ: node tool/check-boundaries.mjs)

1. features/<f>/** ห้าม import features/<g>/** อื่น — ข้าม feature ผ่าน navigation หรือ query
   cache invalidation (queryKey namespace) เท่านั้น
2. @omnistock/contracts generated client แตะได้เฉพาะ features/*/api/** + lib/api/**
3. components/ui/** ห้าม import features/**, lib/api/**, lib/org/**, lib/session/** — ต้องคง
   feature-agnostic + org-agnostic (apps/back-office จะ reuse ชั้นนี้)
4. lib/** ห้าม import features/** หรือ components/** (leaf layer)
5. org-scoped API client มาจาก lib/org/org-context.tsx (useOrgApiClient) เท่านั้น — ห้าม feature
   สร้าง client เอง

## Pattern บังคับ

- **API client**: hook ใน features/*/api/ สร้างจาก useOrgApiClient() เท่านั้น (org header ได้ฟรี) —
  endpoint ที่ไม่ผูก org (auth, org list) ใช้ lib/auth-client.ts หรือ base client แยกชัด
- **Read**: ทุกจอ render ผ่าน <QueryStateView query={...}> → ได้ 4 states (skeleton/empty/error/data)
  ครบเสมอ · จอ list ใช้ <DataTable> + useUrlTableState (URL-synced pagination/sort/filter)
- **Mutation เงิน/สต๊อก = pessimistic เสมอ** — ห้าม optimistic, ห้ามคำนวณเงิน/สต๊อกบน client, จอสต๊อก
  คือ "บันทึกการเคลื่อนไหว" ไม่ใช่ "แก้ตัวเลข" · mutation สำเร็จ → invalidateQueries ที่เกี่ยว
- **Error**: จับผ่าน toApiFailure(err) แบบ discriminated union · ข้อความผู้ใช้มาจาก failureMessage()
  เท่านั้น — ห้าม render code/raw message จาก server
- **Gating**: ปุ่ม/ส่วนจอ ตาม role ใช้ useCan('capability') (ซ่อน/disable) · ตาม tier ใช้ <FeatureGate>
  (โชว์+ล็อก+อัปเกรด — ห้ามซ่อน) · route segment ครอบด้วย <RouteGuard requiredCapability> — server
  enforce เสมอ (client = UX only)
- **Form**: react-hook-form + zod เสมอสำหรับฟอร์มที่ >2 field หรือมี validation ที่ไม่ใช่ required
  เฉย ๆ · dirty-state guard ทุกฟอร์มที่แก้ไขข้อมูลจริง (useConfirmNavigation)
- **i18n**: copy เป็น key ใน src/i18n/<feature>.ts เสมอ — copy เป็นของ ux ห้ามแต่งเอง
- **format**: เงิน/วันที่/จำนวน ผ่าน lib/format เท่านั้น — ห้าม format มือ, ห้าม money math บน client
- **theme**: ใช้ Tailwind utility ที่ผูก token เท่านั้น (`bg-primary`, `text-danger-text`, ฯลฯ — ดู
  design-system.md §1.5) — ห้าม hardcode สี/ระยะ/arbitrary value (token ขาด → แจ้ง @ux ห้ามเลือกค่าเอง)

## เทสต์ (D-014 — ไม่มีข้อยกเว้น)

- ทุกไฟล์ implement มีเทสต์ mirror ใน src/**/*.test.ts(x): lib=vitest ตรง · api hooks=renderHook+MSW ·
  components=renderWithProviders ครบ 4 states · forms=zod schema เพียว — ห้ามมีเทสต์แตะ network จริง
- ผ่านครบก่อนส่งงาน: pnpm --filter web typecheck && lint && test && node tool/check-boundaries.mjs
  — รายงานผลตามจริง

## ห้ามตัดสินเอง (escalate)

- contract/endpoint/shape → backend-api · flow/copy/token → ux · scope/AC → product
- ★ task (token/auth/session/CSRF/sensitive render/deep link) → ทำตาม client-security skill +
  security-reviewer pass
```

---

*อ้างอิง: [design-brief.md](design-brief.md) · [docs/architecture/mobile.md](mobile.md) (semantics ที่
mirror) · [docs/06-clients.md](../06-clients.md) · [docs/design-system.md](../design-system.md) ·
[docs/DECISIONS.md](../DECISIONS.md) D-014/D-019/D-020 · โค้ดจริง `apps/web/src/**` @ 0e5b3c1*
