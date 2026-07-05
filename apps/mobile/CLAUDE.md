# apps/mobile — CLAUDE.md

แนวทางสำหรับ AI agent ที่แก้ `apps/mobile` · อ่าน [root CLAUDE.md](../../CLAUDE.md) + [workspace-map](../../docs/workspace-map.md) ก่อน

## นี่คืออะไร

Flutter mobile app ของ OmniStock
**เจ้าของ:** `frontend` (behavior/code) · flow/copy/visual → `ux` · สร้างใน F-000 T-000-09 (placeholder shell)

## Stack / toolchain

Flutter **3.27.3** (Dart 3.6) — pin ผ่าน **FVM** (`.fvm/`) + `apps/mobile/scripts/flutter.sh` (turbo→flutter adapter; ใช้ `fvm flutter` บน dev, plain `flutter` บน CI ผ่าน `.flutter-version`)

> เครื่องที่มี Flutter รุ่นอื่นให้ใช้ `fvm flutter ...` เสมอ

## โครงสร้าง

- `lib/main.dart` — placeholder shell; import `package:omnistock_api_client` (พิสูจน์ว่า consume wired Dart client ได้ — AC3)
- `api_client/` — **generated Dart client (OpenAPI, dart-dio)** เป็น sibling package (ไม่อยู่ใน `lib/` โดยตั้งใจ: package ซ้อนใน lib/ ของอีก package ทำให้ built_value library กับ `.g.dart` part คนละ language version → compile ไม่ผ่าน) · generate จาก `packages/contracts` (`gen:contracts:dart` รัน openapi-generator + build_runner) — **อย่าแก้มือ**, regen เท่านั้น
- `analysis_options.yaml` — exclude `api_client/**` (generated, wired-only; typed usage เต็ม → F-006/D-004)
- `android/`, `ios/`, `test/`

## กฎเมื่อแก้

- คุยกับ API ผ่าน generated Dart client เท่านั้น; เปลี่ยน contract ที่ `packages/contracts`
- secure storage / deep link / token: ทำตาม skill `client-security` (บังคับบน ★ task)
- อย่าตัดสิน API/data shape เอง (→ backend-api) · flow/copy → ux
- **ทุก task ที่ implement ต้องมี unit/widget test ประกบเสมอ** (D-014) — test: `fvm flutter test` (required ใน CI flutter-ci)

## คำสั่ง

`fvm flutter analyze` · `fvm flutter test` · `fvm flutter build apk --debug` (ทั้งสามเขียวใน F-000) · turbo: `pnpm --filter mobile build|lint|test` (shell ไป flutter)
