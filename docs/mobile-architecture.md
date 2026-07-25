# Mobile Architecture — apps/mobile (Flutter)

> **Status: APPROVED — D-023 (user เคาะ 2026-07-07: โครงสร้าง + Riverpod + refactor ก่อน merge)**
> เจ้าของ: frontend (โครงสร้าง) · PM (dependency rule + gate) · ที่มา: user review ของ T-001-17
> ชี้ว่าโครง flat `lib/auth/` + ไม่มี state management ไม่รองรับ scale ของ backlog
> ใช้คู่กับ [docs/02-architecture.md](02-architecture.md) (ระบบรวม) + [design-system.md](design-system.md) (visual)

## 1. แรงกดดันจาก roadmap ที่โครงสร้างต้องรับ (ทำไมต้องทำตอนนี้)

จาก [features/README.md](features/README.md) mobile จะโต **~10+ feature ภายใน Phase 1-2**:

| ที่จะมา | สิ่งที่บังคับโครงสร้าง |
|---|---|
| F-006 app shell | navigation กลาง, push wiring, bootstrap (F-001 วาง `runAuthBootstrap` แล้ว) |
| F-002/F-003 org + roles | **ทุกจอ scoped ด้วย active org** — ต้องมี session context กลาง + org switcher ที่ไม่ต้องรื้อทุก feature |
| F-007 tier entitlements | จอ/ปุ่ม gated ด้วย `can(org, capability)` — ต้อง gate ที่ router + widget แบบ declarative |
| F-013 สต๊อก · F-024 ออเดอร์ · F-030 dashboard · F-027 sync health | จอ operational CRUD+realtime จำนวนมาก — pattern ต้องปั๊มซ้ำได้เร็วโดย quality ไม่หลุด |
| F-028 notifications (push/LINE) | background/foreground push → state ต้อง update ข้าม feature |
| F-093 stock take | flow นับของหน้างาน (เน็ตไม่นิ่ง) — ต้องมี seam สำหรับ queue/retry |
| กฎทอง | เงินคำนวณฝั่ง server เท่านั้น (client แสดงผล) · ทุก call ผูก org · ledger append-only |

บทเรียนจาก F-001: `auth_client.dart` ปน 2 หน้าที่ (refresh-machinery ของทุก request + auth endpoints), widgets design-system ปนกับ widgets เฉพาะ feature, `main.dart` ทำ manual navigation — ถ้าปล่อยไป F-006+ จะ copy pattern นี้ทั้ง 10 features

## 2. Pattern ที่เลือก: **feature-first + layered (pragmatic clean architecture)**

หลักคิด: **แบ่งตาม feature ก่อน** (scale ตาม backlog — feature ใหม่ = โฟลเดอร์ใหม่ ไม่แตะของเก่า)
แล้ว**แบ่ง layer ภายใน feature** (testable ทุกชั้น) — ไม่ใช่ layer-first ทั้งแอป (layer-first ตาย
ตอน 30 features เพราะงาน 1 feature กระจาย 4 โฟลเดอร์ยักษ์)

```
apps/mobile/lib/
├── main.dart                     # thin: runApp(ProviderScope(child: App())) เท่านั้น
├── app/                          # composition root (F-006 เป็นเจ้าของตัวเต็ม)
│   ├── app.dart                  # MaterialApp.router + theme
│   ├── router.dart               # go_router: routes + guards (authed? org-selected? can(cap)?)
│   ├── bootstrap.dart            # start-up sequence (เรียก auth bootstrap controller)
│   └── theme/                    # ThemeData จาก design tokens (ย้ายจาก lib/theme)
├── core/                         # cross-cutting — ห้ามมี logic เฉพาะ feature
│   ├── api/                      # ★ Dio factory + interceptors: attach access token,
│   │   │                         #   single-flight refresh-on-401, org header, error mapping
│   │   │                         #   (= ส่วน "ทุก request" ที่แยกออกจาก auth_client เดิม)
│   │   └── api_providers.dart    # provider ของ Dio/generated clients (override ได้ในเทสต์)
│   ├── storage/                  # secure storage wrapper (Keychain/Keystore)
│   ├── session/                  # [seam F-002/F-007] active-org context + entitlements
│   ├── push/                     # [seam F-028] push token/handler registry
│   ├── security/                 # screenshot_guard ฯลฯ
│   ├── error/                    # error taxonomy กลาง (ApiFailure/Network/Validation)
│   ├── i18n/                     # ไทยครบก่อน — ไฟล์ per-feature (auth_th.dart, stock_th.dart)
│   ├── utils/                    # relative_time ฯลฯ
│   └── ui/                       # design-system widgets ที่ contribute-back
│                                 #   (Button, TextField, PasswordField, ErrorBanner,
│                                 #    Toast, ConfirmDialog, Skeleton — จาก F-001)
└── features/
    └── auth/                     # (โครงเดียวกันทุก feature ที่จะมา: stock/, orders/, …)
        ├── domain/               # PURE DART — ห้าม import Flutter/dio/generated client
        │   ├── entities/         #   Session, AuthTokens (ไม่ใช่ DTO ที่ gen มา)
        │   ├── repositories/     #   AuthRepository (abstract contract)
        │   └── usecases/         #   เฉพาะเมื่อมี logic จริง เช่น password_policy,
        │                         #   run_auth_bootstrap (ตัดสิน restore/login/transient)
        ├── data/                 # implement contract — ที่เดียวที่แตะ generated client
        │   ├── auth_repository_impl.dart   # แปลง DTO→entity, จัดการ token persistence
        │   └── token_store.dart             # access=memory-only, refresh=secure storage
        ├── application/          # STATE MANAGEMENT — Riverpod controllers
        │   ├── bootstrap_controller.dart    # AsyncNotifier<BootstrapState>
        │   ├── auth_controller.dart         # login/signup/logout state
        │   ├── session_list_controller.dart
        │   └── change_password_controller.dart
        └── presentation/
            ├── screens/          # login, signup, security, bootstrap gate, login help
            └── widgets/          # เฉพาะ auth: session_list_item, throttle_banner
```

### Dependency rule (บังคับด้วย gate — ดู §6)

```
presentation ──► application ──► domain ◄── data
     │                │             ▲
     └── core/ui ─────┴── core/* ───┘   (core ไม่รู้จัก features/)
```

- `domain/` = pure Dart: **ห้าม** import `flutter/*`, `dio`, `omnistock_api_client`, Riverpod
  → unit test ด้วย `dart test` เพียวๆ ไม่มี mock framework ก็ได้ (คู่ขนาน `packages/core-domain` ฝั่ง server)
- generated `omnistock_api_client` ถูก import ได้ **เฉพาะ** `features/*/data/` + `core/api/`
- feature ห้าม import feature อื่นตรงๆ — ข้าม feature ผ่าน `core/session` หรือ domain event เท่านั้น
- **ห้ามมี logic เงิน/สต๊อกฝั่ง client** — domain ฝั่ง mobile คือ view/workflow logic;
  ตัวเลขเงิน/COGS/available มาจาก server เสมอ (กฎทอง — client แค่ format)

## 3. State management: **Riverpod** (flutter_riverpod ^2.x)

ตอบโจทย์ "inject unit test ได้ทุก layer" ตรงตัว — Riverpod เป็นทั้ง **DI container + state**:
provider ทุกตัว override ได้ใน `ProviderContainer`/`ProviderScope` → เทสต์ swap fake ที่**ทุก**รอยต่อ
(repo ปลอมให้ controller, controller ปลอมให้ widget) โดยไม่ต้อง service locator หรือ context hack

| เกณฑ์ | **Riverpod (เลือก)** | Bloc | GetX / Provider |
|---|---|---|---|
| Testability/DI | override ทุก provider = inject ได้ทุกชั้น | testable แต่ DI แยกต้องหาเอง (get_it) | GetX = magic locator, จับ dependency ยาก |
| 4 states ของ design-system | `AsyncValue` มี loading/error/data ในตัว | ต้องประกาศ state class เอง ทุก bloc | ad-hoc |
| Ceremony ต่อ 1 จอ CRUD | Notifier เดียว | event+state+bloc 3 ไฟล์ | ต่ำแต่แลกกับ discipline |
| Compile safety | สูง (no string keys, no context lookup) | สูง | Provider: runtime lookup |
| ทีม AI agent ปั๊ม feature ซ้ำ | pattern สั้น สอนง่าย exemplar ชัด | ได้ แต่ boilerplate ~2× | เสี่ยง pattern เพี้ยน |

- เริ่มแบบ **ไม่ใช้ riverpod_generator** (manual provider — ลด build_runner surface;
  เปิดใช้ทีหลังได้ไม่ rewrite) · `AsyncNotifier` เป็น default ของ controller ที่คุย repo
- Dependency ใหม่: `flutter_riverpod` (+`fake_async`/`mockito` เดิม) — ผ่านเกณฑ์ new-dep ต้อง PM/user approve → รวมในการเคาะครั้งนี้

## 4. Testing ต่อ layer (D-014 ยังบังคับเหมือนเดิม)

| Layer | วิธีเทสต์ | ตัวอย่างจากของจริง F-001 |
|---|---|---|
| domain | `dart test` ล้วน — pure fn/entity | password policy, bootstrap decision (มีอยู่แล้ว ย้ายเข้า) |
| data | repo impl + `FakeHttpClientAdapter` (มีแล้วใน test/auth/fake_dio_adapter.dart) | rotation/wipe-on-401/transient (127 เทสต์เดิม map ลงชั้นนี้เยอะสุด) |
| application | `ProviderContainer(overrides:[repoProvider.overrideWith(fake)])` | bootstrap restore/transient/expired |
| presentation | widget test + `ProviderScope(overrides:)` | จอ login/signup/session list (ของเดิมแปลง) |
| นโยบาย | **ทุก layer มีรอยต่อ inject ได้ → ไม่มีเทสต์ไหนต้องแตะ network/keychain จริง** | |

## 5. Migration map (F-001 auth → โครงใหม่) — ไม่มี logic ใหม่ เป็น "ย้าย+แยกหน้าที่"

| ของเดิม (`lib/auth/…`) | ไปที่ | หมายเหตุ |
|---|---|---|
| `auth_client.dart` | **แยก 2**: refresh/single-flight (+`RefreshOutcome`/`SessionExpiredException`) → `core/api/refresh_coordinator.dart` · endpoints → `features/auth/data/auth_repository_impl.dart` | จุดสำคัญสุด — F-013+ ทุก feature ได้ refresh ฟรีผ่าน core/api |
| `token_store.dart` | `features/auth/data/` | สัญญาเดิม: access=memory, refresh=keychain |
| `secure_storage.dart` | `core/storage/` | generic wrapper |
| `auth_bootstrap.dart` | usecase → `features/auth/domain/usecases/` + controller → `application/bootstrap_controller.dart` | seam F-006 คงเดิม (shell เรียก controller) |
| `auth_client_factory.dart` | **แยก 2** (as-built): https-in-release guard (M-3, feature-agnostic) → `core/api/https_guard.dart` · `createAuthClient` (สร้าง repo ของ auth) → `features/auth/data/auth_client_factory.dart` | ย้ายทั้งไฟล์ไป core ไม่ได้ — จะทำให้ core import features (ผิดกฎ §6 เอง) |
| (ใหม่) domain `Session` entity | `features/auth/domain/entities/` | เดิม widgets import DTO ที่ gen มาโดยตรง = ละเมิด rule 3; repo แปลง DTO→entity แล้ว |
| `screens/*` | `features/auth/presentation/screens/` | เปลี่ยน wiring เป็น `ref.watch` |
| `widgets/*` generic (toast, confirm_dialog, error_banner, labeled_text_field, password_field, skeleton) | `core/ui/` | คือ contribute-back ตาม design-system |
| `widgets/*` เฉพาะ auth (session_list_item, throttle_banner) | `features/auth/presentation/widgets/` | |
| `throttle_countdown*` | controller → `application/` · widget → `presentation/` | |
| `validation.dart` | `features/auth/domain/` | password policy = domain rule ฝั่ง view |
| `error_messages.dart` | `core/error/` + `core/i18n/` | taxonomy กลาง ทุก feature reuse |
| `screenshot_guard.dart` | `core/security/` | |
| `relative_time.dart` | `core/utils/` | |
| `i18n/auth_th.dart`, `theme/` | `core/i18n/`, `app/theme/` | |
| `main.dart` | thin — เหลือ `ProviderScope` + `App` | นาว์เกชันเต็มไป `app/router.dart` (F-006 เติม) |

เทสต์ 127 ตัวเดิม: ย้ายตามชั้น + เปลี่ยนการประกอบจาก constructor-มือ เป็น provider override —
**พฤติกรรมต้องเท่าเดิม** (นี่คือ regression net ของการ refactor เอง) · ★ primitives
(token store/wipe/rotation) logic ไม่เปลี่ยน จึงไม่ต้อง ★ full re-review — ขอ ★ sanity pass สั้นๆ
เฉพาะ diff ว่าการย้ายไม่เปิด surface ใหม่

## 6. Enforcement (กันโครงเสื่อมเมื่อ agent หลายตัวปั๊ม feature)

- เพิ่ม **mobile boundary gate** ใน CI (คู่ขนาน depcruise ฝั่ง server): script เช็ค import
  ต้องห้าม — `features/*/domain` ห้ามมี flutter/dio/generated · `core/` ห้าม import `features/`
  · generated client โผล่ได้เฉพาะ `data/`+`core/api/` (dart analyze + custom lint หรือ script grep AST)
- `apps/mobile/CLAUDE.md` อัปเดตเป็นแผนที่โครงนี้ + exemplar ชี้ `features/auth/` เป็นต้นแบบ
  ทุก feature ใหม่ (agent อ่านก่อน build เสมอ)
- Template สำหรับ feature ใหม่: โฟลเดอร์ 4 ชั้น + provider wiring + ไฟล์เทสต์ 4 ชั้น

## 7. ทางเลือกการ adopt (ให้ user เคาะ)

- **(แนะนำ) Refactor ก่อน merge PR #5** — main เริ่มต้นด้วยโครงที่ถูก; F-006 build ต่อทันที
  ไม่มี tech debt ตั้งแต่ commit แรก · งาน ~1 รอบ frontend agent (ย้าย+rewire+เทสต์ 127 ต้องเขียวเท่าเดิม)
  · CI 7 lanes จับ regression · ★ sanity pass ปิดท้าย
- ทางเลือก B: merge F-001 ตามสภาพ แล้ว refactor เป็น task แรกของ F-006 — merge เร็วกว่า
  แต่ main มีโครงเก่าคั่นกลาง และเสี่ยง F-006 เริ่มบนของที่กำลังจะรื้อ

## 8. สิ่งที่ doc นี้ **ไม่** ตัดสิน (ปลายทางอื่น)

- Navigation library ตัวจริง + deep-link scheme → F-006 Gate-2 (โครงจองที่ `app/router.dart` ไว้ให้)
- Offline queue จริงของ F-093 → design ตอน feature นั้น (จองแค่ seam `core/api` interceptor)
- Push provider (FCM/APNs wiring) → F-028 (seam `core/push/`)
