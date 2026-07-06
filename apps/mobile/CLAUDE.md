# apps/mobile — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/mobile` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

Flutter mobile app ของ OmniStock
**เจ้าของ:** `frontend` (behavior/code) · flow/copy/visual → `ux` · สร้างใน F-000 T-000-09 (placeholder shell)

## Stack / toolchain

Flutter **3.27.3** (Dart 3.6) — pin ผ่าน **FVM** (`.fvm/`) + `apps/mobile/scripts/flutter.sh` (turbo→flutter adapter; ใช้ `fvm flutter` บน dev, plain `flutter` บน CI ผ่าน `.flutter-version`)

> เครื่องที่มี Flutter รุ่นอื่นให้ใช้ `fvm flutter ...` เสมอ

## โครงสร้าง — **D-023: feature-first clean architecture** (อ่าน [docs/mobile-architecture.md](../../docs/mobile-architecture.md) ก่อนแก้เสมอ)

- `lib/app/` — composition root: `app.dart`, theme, bootstrap wiring (F-006 เติม router เต็ม)
- `lib/core/` — cross-cutting เท่านั้น (**ห้าม import `features/`**): `api/` (Dio factory,
  `https_guard`, `refresh_coordinator` = single-flight refresh ที่ทุก feature ใช้ร่วม),
  `storage/`, `security/`, `error/`, `i18n/`, `utils/`, `ui/` (design-system widgets)
- `lib/features/<f>/` — 4 ชั้นต่อ feature: `domain/` (**pure Dart** — ห้าม flutter/dio/generated/riverpod)
  → `data/` (ที่เดียวที่แตะ generated client; แปลง DTO→entity) → `application/` (Riverpod controllers)
  → `presentation/` (screens+widgets) · **`features/auth/` = exemplar ของทุก feature ใหม่**
- `lib/main.dart` — thin: `ProviderScope` + `OmniStockApp` เท่านั้น
- `tool/check_boundaries.dart` — **boundary gate** (รันใน CI flutter-ci): domain purity ·
  core↛features · generated client เฉพาะ `data/`+`core/api/` · ห้าม cross-feature import
- `api_client/` — **generated Dart client (OpenAPI, dart-dio)** เป็น sibling package (ไม่อยู่ใน `lib/` โดยตั้งใจ: package ซ้อนใน lib/ ของอีก package ทำให้ built_value library กับ `.g.dart` part คนละ language version → compile ไม่ผ่าน) · generate จาก `packages/contracts` (`gen:contracts:dart` รัน openapi-generator + build_runner) — **อย่าแก้มือ**, regen เท่านั้น
- `analysis_options.yaml` — exclude `api_client/**` (generated)
- `android/`, `ios/`, `test/` (โครง test mirror `lib/`)

## กฎเมื่อแก้

- **ทำตาม dependency rule ของ D-023 เสมอ** — feature ใหม่ copy โครงจาก `features/auth/`;
  แก้แล้วรัน `fvm dart run tool/check_boundaries.dart` ให้ผ่านก่อนส่งงาน
- State management = **Riverpod** (manual providers, ไม่ใช้ codegen) — controller เป็น
  `(Async)Notifier` ใน `application/`; ทุก provider ต้อง override ได้ในเทสต์
- **ห้ามมี logic เงิน/สต๊อกฝั่ง client** — แสดงค่าที่ server คำนวณเท่านั้น (กฎทอง)
- คุยกับ API ผ่าน generated Dart client เท่านั้น (จาก `data/`+`core/api/` เท่านั้น); เปลี่ยน contract ที่ `packages/contracts`
- secure storage / deep link / token: ทำตาม skill `client-security` (บังคับบน ★ task)
- อย่าตัดสิน API/data shape เอง (→ backend-api) · flow/copy → ux
- **ทุก task ที่ implement ต้องมี unit/widget test ประกบเสมอ** (D-014) — test: `fvm flutter test` (required ใน CI flutter-ci)

## คำสั่ง

`fvm flutter analyze` · `fvm flutter test` · `fvm flutter build apk --debug` (ทั้งสามเขียวใน F-000) · turbo: `pnpm --filter mobile build|lint|test` (shell ไป flutter)
