# apps/mobile — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/mobile` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

Flutter mobile app ของ OmniStock — **client หลักฝั่ง use** (mobile-parity-first: เปิดร้าน/ขายของจบในเครื่องเดียว)
**เจ้าของ:** `frontend` (behavior/code) · flow/copy/visual → `ux`

> **Architecture authority: [docs/architecture/mobile.md](../../docs/architecture/mobile.md)** —
> target design เต็ม + playbook เพิ่ม feature (§5.3) + gap plan (§6) · decision ฐาน: [docs/mobile-architecture.md](../../docs/mobile-architecture.md) (D-023)

## Stack / toolchain

Flutter **3.44.6 stable** (Dart 3.12) — pin ผ่าน **FVM** (`.fvm/`) + `apps/mobile/scripts/flutter.sh`
(turbo→flutter adapter; dev ใช้ `fvm flutter ...` เสมอ) · state/DI = **Riverpod** (manual providers, ไม่ใช้ codegen)
· Android toolchain: Gradle 8.9 · AGP 8.6.0 · Kotlin 2.0.0 (ต่ำสุดที่ SDK นี้ยอมรับ, Groovy DSL เดิม —
`android.newDsl=false`; รายละเอียด/เหตุผล: [forward-commitments.md](../../docs/features/forward-commitments.md) แถว "native compile lane")

## โครงสร้าง (D-023 — feature-first + 4 ชั้น)

- `lib/app/` — composition root: `app.dart`, bootstrap (F-006 เติม router เต็ม) — **ห้ามไฟล์อื่น import
  `app/**`** ยกเว้น `main.dart` (gate rule 6); theme ย้ายไป `core/theme/` แล้วเพราะทุก layer ใช้ร่วม
- `lib/core/` — cross-cutting เท่านั้น (**ห้าม import `features/`**): `api/` (interceptor chain:
  `https_guard`/`auth_token`/`refresh` (`QueuedInterceptor`, reuse `refresh_coordinator`)/`error_mapping`),
  `error/` (`api_failure.dart` sealed taxonomy), `l10n/` (gen_l10n), `theme/`, `storage/`, `security/`,
  `utils/`, `ui/`
- `lib/features/<f>/` — 4 ชั้น: `domain/` (**pure Dart**) → `data/` (ที่เดียวที่แตะ generated client;
  แปลง DTO→entity) → `application/` (Riverpod controllers) → `presentation/`
  **exemplar: `features/auth/`** (โครง+เทสต์ 127 ตัว) — feature ใหม่ copy โครงนี้เสมอ
- `api_client/` — generated Dart client (dart-dio) sibling package — **อย่าแก้มือ**, regen เท่านั้น
- `tool/check_boundaries.dart` — boundary gate (CI): domain purity · core↛features ·
  generated client เฉพาะ `data/`+`core/api/` · ห้าม cross-feature import

## กฎเหล็ก (gate จับ — รัน `fvm dart run tool/check_boundaries.dart` ก่อนส่งงานเสมอ)

1. `domain/` ห้าม import flutter / dio / omnistock_api_client / riverpod
2. `core/` ห้าม import `features/`
3. generated client แตะได้เฉพาะ `features/*/data/` + `core/api/`
4. ห้าม import ข้าม feature — คุยข้าม feature ผ่าน core layer เท่านั้น
5. **ห้ามมี logic เงิน/สต๊อกฝั่ง client** — แสดงค่าที่ server คำนวณเท่านั้น (กฎทอง) ·
   mutation เงิน/สต๊อก = **pessimistic เสมอ** (ห้าม optimistic) · จอสต๊อก = "บันทึก movement" ไม่ใช่ "แก้ตัวเลข"
6. ทุก provider ต้อง override ได้ในเทสต์ · controller = `(Async)Notifier` ใน `application/`
7. ทุกจอ render ครบ 4 states (skeleton/empty/error/data) ตาม design-system ·
   copy ไทยผ่าน `core/l10n` (gen_l10n, `lib/l10n/app_th.arb`) — copy เป็นของ ux ห้ามแต่งเอง · theme (`core/theme/`)
   ใช้ token เท่านั้น ห้าม hardcode สี/ระยะ
8. อย่าตัดสิน API/data shape เอง (→ backend-api) · ★ task (token/auth/deep link) → skill `client-security`
9. (gate rule 6) ห้ามไฟล์ไหน import `app/**` ยกเว้น `main.dart` — `app/` เป็น composition root ทางเดียว
   (import `app/` -> `app/` เอง เพื่อประกอบตัวเองก็ถูกกฎ)
10. (gate rule 7) `features/*/presentation/**` ห้าม import `core/api/**` ตรง ๆ — จอห้ามยิง HTTP เอง
    ต้องผ่าน `application/` -> `data/`; ต้องการแค่ TYPE (เช่น `SessionExpiredException`) ให้ re-export ผ่าน
    `domain/` แทน (ดู `features/auth/domain/exceptions.dart` เป็นตัวอย่าง)

## Target patterns — เมื่อ build feature ที่แตะเรื่องนี้ **ให้ implement ตาม arch doc ห้ามคิด pattern เอง**

infra ที่ **มีของจริงแล้ว** (pre-Phase-1 hardening batch, docs/architecture/refactor-plan.md §4 R2-R5) —
ใช้ของจริง ห้ามสร้างซ้ำ:

- **Interceptor chain** (`core/api/`: `https_guard_interceptor` → `auth_token_interceptor` →
  `refresh_interceptor` (`QueuedInterceptor`, reuse `RefreshCoordinator`) → `error_mapping_interceptor`) —
  repo ใหม่สร้าง `Dio` ตามแบบ `features/auth/data/auth_client_factory.dart` (สอง `Dio`: ตัวหลัก + `retryDio`
  ไม่มี `RefreshInterceptor` — กัน deadlock เมื่อ retry เรียกผ่าน dio เดิม) แล้วปล่อยให้ repo เรียกตรง ๆ
  ไม่ต้องเขียน `requestWithRefresh`/`_bearerOptions()` เอง — endpoint ไหนต้อง auth/refresh อ่านจาก
  `extra['secure']` ที่ generated client ใส่มาให้ (ไม่ใช่ flag ที่ repo ต้องจำตั้งเอง)
- **sealed `ApiFailure`** (`core/error/api_failure.dart` + `core/api/error_mapping.dart`) — catch
  `on DioException catch (e) { throw e.error is ApiFailure ? e.error as ApiFailure : const ServerFailure(); }`
  แทนเขียน status/code switch เอง; `failureMessage(t, failure)` ให้ copy กลาง
- **i18n** (`core/l10n/l10n.dart` + `lib/l10n/app_th.arb`, gen_l10n) — `presentation/` ใช้
  `AppLocalizations.of(context)`; `application/` (ไม่มี `BuildContext`) ใช้ `l10n` getter — ไทยอย่างเดียว
  ตอนนี้ (โครงพร้อมรับ `app_en.arb` ทีหลัง)
- `authRepositoryProvider`-style provider ควร type เป็น **abstract repository** เสมอ (ไม่ใช่ concrete impl)

infra ที่ **ยังไม่มีของจริง** (อย่า import ของที่ยังไม่มี) — feature แรกที่แตะคือผู้สร้างตาม spec:

| เรื่อง | ตาม | เกิดที่ |
|---|---|---|
| Router/guards/deep link (`omnistock://o/<orgId>/...`) — go_router | mobile.md §3.5 | F-006 |
| `core/session` (activeOrg/entitlements) + `orgDioProvider` — repo ทุกตัวสร้างจากตัวนี้ · org header interceptor (seam commented in `auth_token_interceptor.dart`, not built) | mobile.md §3.2 | F-002/006/007 |
| Event bus `core/events` (cross-feature reaction) · push plumbing | mobile.md §3.6 | F-006/F-028 |
| `can()`/`entitled()`/`FeatureGate` (2 แกนแยกกัน) · `app_en.arb` (English) | mobile.md §3.3/§3.7 | F-003/007 · ราย feature |
| `PagedListController`+`AsyncStateView`+`PagedListView` (cursor `{items,nextCursor}`) | mobile.md §3.3 | F-013 |
| Offline: ReadCache/Outbox ports (Outbox จริง = F-093 เท่านั้น) · hardware ports (กล้อง/สแกน/พิมพ์) | mobile.md §4 | F-093/ราย feature |
| `RetryInterceptor` (GET idempotent retry + backoff) — ยังไม่อยู่ในเชน | mobile.md §3.4 | ยังไม่ตัดสิน |

## เทสต์ (D-014 — ไม่มีข้อยกเว้น)

ทุกไฟล์ implement มีเทสต์ mirror ใน `test/` ชั้นเดียวกัน: domain=dart test เพียว · data=FakeHttpClientAdapter ·
application=`ProviderContainer(overrides)` · presentation=widget test ครบ 4 states —
ห้ามมีเทสต์แตะ network/keychain จริง · ผ่านครบก่อนส่งงาน: `fvm flutter analyze` · `fvm flutter test` · boundary gate — รายงานผลตามจริง

## คำสั่ง

`fvm flutter analyze` · `fvm flutter test` · `fvm flutter build apk --debug` · turbo: `pnpm --filter mobile build|lint|test`
