# Mobile Architecture (definitive) — apps/mobile สำหรับ backlog เต็ม ~40+ features

> **สถานะ: proposed (2026-07-11)** — ผลของรอบ "architecture deep-design" ตาม
> [design-brief.md](design-brief.md) §4 · ออกแบบจากศูนย์แล้วค่อยเทียบกับ D-023 + โค้ดจริง (§6)
> เอกสารนี้ **ขยายและแทนที่** [docs/mobile-architecture.md](../mobile-architecture.md) (D-023) เมื่อ user เคาะ —
> D-023 ยังถูกต้องเป็นแกน (feature-first + 4 layers + Riverpod) เอกสารนี้เติมส่วนที่ D-023 ประกาศว่า "ไม่ตัดสิน"
> (router, session/org, networking เต็มรูป, offline, performance, hardware, i18n runtime) ให้ครบระดับ backlog เต็ม
> ใช้คู่กับ: [docs/06-clients.md](../06-clients.md) (บทบาท mobile) · [docs/design-system.md](../design-system.md) (visual/4 states)

---

## §1 Design goals + เคสจาก design-brief ที่ต้องตอบ

### 1.1 แรงกดดันจริงที่โครงต้องรับ

1. **Mobile-parity-first** (docs/06) — เจ้าของร้านที่มีแต่มือถือต้องเปิดร้าน/ขายของจบในเครื่องเดียว:
   สร้างสินค้า+bundle, ปรับสต๊อก, ดูออเดอร์, ทำเอกสาร, สแกน/แพ็ค/พิมพ์, dashboard → mobile ไม่ใช่ "companion app"
   แต่เป็น client หลัก ที่จะรับ **จอ operational ของเกือบทุก feature ใน backlog** (~25+ จาก 40+ features tag `both`/`mobile`)
2. **ทีมที่ build คือ AI agents ปั๊มทีละ feature** — pattern ต้องสั้น สอนได้ ทำซ้ำได้โดยคุณภาพไม่หลุด
   และ invariant สำคัญ (org-scope, error mapping, 4 states) ต้อง**ได้ฟรีจากโครง** ไม่ใช่ "จำได้ก็รอด"
3. **เน็ตไม่นิ่งคือ default** — หน้าร้าน/โกดังไทย, 4G กระพริบ — ทุกจอต้อง degrade อย่างมีศักดิ์ศรี
4. **ห้ามคำนวณเงิน/สต๊อกบน client** (กฎทอง) — mobile เป็นจอแสดงผล + จอสั่ง action; ตัวเลขทุกตัวมาจาก server

### 1.2 ตาราง case coverage (จาก design-brief §2 — เฉพาะที่แตะ mobile)

| Case | คำตอบเชิงโครง (ชี้ § ในเอกสารนี้) |
|---|---|
| **A3** feature ใหม่ = โฟลเดอร์ใหม่ ไม่แตะของเก่า | feature-first 4 layers + route/i18n/event registration แบบ additive (§2, §3.7 playbook) |
| **B1** ทุก call ผูก organizationId | **org-scoped Dio** — client API ทุกตัว derive จาก `activeOrg` provider → ลืมไม่ได้เชิงโครงสร้าง (§3.2) + org header interceptor |
| **B2** FeatureGate declarative ทุก surface | `FeatureGate` widget + `entitled()` provider + router guard อ่าน state เดียวกัน (§3.3) |
| **B3** RBAC capability check ไม่ปนกับ B2 | `can(capability)` แยก provider จาก `entitled(feature)` — คนละแกน (role vs tier) ประกอบกันที่จุดใช้ (§3.3) |
| **B4** ledger immutability | UI สต๊อก = "บันทึก movement" เสมอ ไม่มีจอ "แก้ตัวเลข"; mutation เงิน/สต๊อกเป็น pessimistic เท่านั้น (§4.3) |
| **B5** Money Decimal / stock int / Asia-Bangkok | client ไม่มี money math — `core/format` format string จาก server เท่านั้น (§3.6) |
| **B6** error taxonomy กลาง + ไทย | sealed `ApiFailure` ใน `core/error` + mapping กลาง → i18n key เดียวทั้งแอป (§3.4) |
| **B7** audit log | ทุก action ผ่าน API (server audit) — mobile ไม่เก็บ log เอง; แนบ `deviceId` ใน header ให้ server ใช้ |
| **B8** testability D-014 | ทุกชั้นเป็น provider ที่ override ได้ — ไม่มีเทสต์แตะ network/keychain/hardware จริง (§5) |
| **D1** เน็ตไม่นิ่ง | retry policy (GET เท่านั้น), transient vs terminal failure, read-cache port, outbox seam F-093 (§4.2–4.3) |
| **D2** real-time-ish updates | typed `AppEvent` bus ใน `core/events` — push/poll ยิง event → provider invalidateSelf (§3.5) |
| **D3** list 1k–10k | `PagedListController` กลาง + cursor pagination convention เดียว + `ListView.builder` discipline (§4.1) |
| **D4** form หนัก + validation ไทย | form pattern มาตรฐาน: controller (Notifier) + validation ใน `domain/` (pure) + copy จาก i18n (§3.7) |
| **D5** org switch กระทบทุกจอ | org-scoped Dio → provider graph ทั้งใต้ต้น rebuild อัตโนมัติ ไม่มี state รั่วข้าม org (§3.2) |
| **D6** push → deep link + org ที่ถูก | URI scheme ฝัง orgId + router guard สลับ org ก่อน navigate (§3.5) |
| **D7** กล้อง/สแกน/พิมพ์ | hardware ports ใน `core/hardware` — widget test fake ได้ (§3.6) |
| **D8** 4 states ทุกจอ | `AsyncValue` + `AsyncStateView` wrapper บังคับครบ loading(skeleton)/empty/error/data (§3.1) |
| **D9** performance | startup budget, image caching, rebuild discipline, `select()` (§4.4) |
| **E1** OpenAPI contract เดียว | generated dart-dio client เป็นทางเดียวเข้า API — import ได้เฉพาะ `data/`+`core/api` (gate rule 3) |
| **A6/A7 (ทางอ้อม)** | mobile เห็นแค่ contract — connector/payment/AI เพิ่มฝั่ง server ไม่กระทบโครง mobile |

---

## §2 Target architecture

### 2.1 Pattern หลัก: feature-first + 4 layers (pragmatic clean architecture) — ยืนยัน D-023

เทียบตัวเลือกอีกครั้งจากศูนย์ (สเกล 40+ features):

| เกณฑ์ | **feature-first + 4 layers (เลือก)** | layer-first ทั้งแอป | full Clean Arch (usecase บังคับทุก call) |
|---|---|---|---|
| A3: เพิ่ม feature ไม่แตะของเก่า | โฟลเดอร์ใหม่ 1 อัน + จุด register 3 จุด (route/i18n/override) | งาน 1 feature กระจาย 4 โฟลเดอร์ยักษ์ — merge conflict ข้าม agent สูง | เหมือนซ้าย แต่ไฟล์ ×1.5 |
| Ceremony ต่อจอ CRUD (งานส่วนใหญ่ของ backlog) | repo + controller + screen (+domain เมื่อมี logic) | เท่ากันแต่หาไฟล์ยาก | +usecase passthrough ทุก method = boilerplate ที่ไม่มี test value |
| AI agent ปั๊มซ้ำ | exemplar 1 feature ลอกได้ทั้งโครง | ลอกยาก (ต้องรู้ 4 ที่) | ลอกได้แต่ผลิต dead layer |
| Testability | ครบ — ทุกชั้นมี seam | ครบ | ครบ (เกินจำเป็น) |

**ความลึกที่ "พอดี" สำหรับแอป CRUD+sync ที่ logic เงิน/สต๊อกอยู่ server:**

- `domain/` **ต้องมีเสมอแต่ผอมโดย default** — entities (ไม่ใช่ DTO ที่ gen มา) + repository contract
  + validation/workflow logic ฝั่ง view (เช่น password policy, ตรรกะนับ stock take ก่อนส่ง, ตรรกะ bootstrap)
  **usecase class = สร้างเฉพาะเมื่อมี logic ตัดสินใจจริง** (เช่น `run_auth_bootstrap`) — ห้ามสร้าง passthrough
  `GetProductsUseCase` ที่แค่เรียก repo (ceremony ไม่จ่ายค่า test value)
- `data/` — ที่เดียวที่แตะ generated client; แปลง DTO→entity; anti-corruption ต่อ contract
- `application/` — Riverpod controllers: ทุก repository call, ทุก loading/error transition
- `presentation/` — widgets โง่ที่สุดเท่าที่ทำได้; effect (focus/clear/navigate) เท่านั้นที่อยู่นี่

เหตุผลที่ entity แยกจาก DTO ยังคุ้มแม้ field ตรงกัน 1:1: contract เปลี่ยน (E1 additive) แล้วจอไม่พัง,
widget test ไม่ต้องประกอบ built_value object, และ domain เทสต์ด้วย `dart test` เพียว (B8)

### 2.2 โครงโฟลเดอร์เป้าหมาย

```
apps/mobile/
├── api_client/                     # generated dart-dio (sibling package — regen เท่านั้น, ห้ามแก้มือ)
├── tool/check_boundaries.dart      # boundary gate (CI) — §5.2
├── lib/
│   ├── main.dart                   # thin: runApp(ProviderScope(overrides: buildAppOverrides(env), child: App()))
│   ├── app/                        # ★ composition root — ที่เดียวที่ import features/* ได้
│   │   ├── app.dart                # MaterialApp.router + theme + locale
│   │   ├── router.dart             # go_router: รวม route ต่อ feature + guard chain (§3.3)
│   │   ├── bootstrap.dart          # buildAppOverrides(env) — ประกอบ adapter จริงทุกตัว
│   │   └── theme/app_theme.dart    # design tokens → ThemeData (มีแล้ว — KEEP)
│   ├── core/                       # cross-cutting — ห้าม import features/ (gate rule 2)
│   │   ├── api/                    # Dio provider + interceptor chain (§3.2):
│   │   │                           #   https_guard · auth attach · org header · refresh (queued,
│   │   │                           #   single-flight) · retry(GET) · error mapping → ApiFailure
│   │   ├── session/                # AuthState + ActiveOrg + capabilities + entitlements (§3.3)
│   │   ├── events/                 # typed AppEvent bus — cross-feature invalidation (§3.5)
│   │   ├── error/                  # sealed ApiFailure taxonomy + failureMessage(failure) → i18n (§3.4)
│   │   ├── async/                  # PagedListController, cacheFor(), AsyncStateView (§3.1, §4.1)
│   │   ├── offline/                # connectivity provider · ReadCache port · OutboxQueue port (F-093) (§4.2)
│   │   ├── push/                   # push token registry + tap payload → deep-link dispatch (F-028 seam)
│   │   ├── hardware/               # ports: BarcodeScanner / CameraCapture / LabelPrinter + impl (§3.6)
│   │   ├── storage/                # SecureStorage wrapper (มีแล้ว)
│   │   ├── security/               # screenshot_guard ฯลฯ (มีแล้ว)
│   │   ├── l10n/                   # ARB (th default, en progressive) + gen_l10n output (§3.6)
│   │   ├── format/                 # Thai money/date/number display formatting (intl) — display เท่านั้น
│   │   ├── utils/
│   │   └── ui/                     # design-system widgets กลาง: Skeleton, ErrorBanner, Toast,
│   │                               #   ConfirmDialog, EmptyState, OfflineBanner, FeatureGate, PagedListView
│   └── features/
│       ├── auth/                   # exemplar (มีแล้ว) — domain/data/application/presentation
│       ├── org/                    # F-002: org list/switcher/invite
│       ├── stock/                  # F-011/13/14: items, movements, adjust, stock-in
│       ├── products/               # F-010/12: product/SKU/bundle
│       ├── orders/                 # F-024: order list/detail/pack
│       ├── sync_health/            # F-027
│       ├── notifications/          # F-028: alert center (push plumbing อยู่ core/push)
│       ├── dashboard/              # F-030
│       ├── documents/              # F-040/42: purchase/sales docs (+camera port)
│       ├── labels/                 # F-050: ใบแปะหน้า (+printer port)
│       ├── stock_take/             # F-093 (+outbox)
│       └── settings/               # F-004 + language switch + force-update screen
└── test/                           # mirror lib/ ทุกชั้น (§5)
```

### 2.3 Dependency rules (บังคับด้วย `tool/check_boundaries.dart` — ดู §5.2)

```
presentation ──► application ──► domain ◄── data
      │               │            ▲
      └── core/ui ────┴── core/* ──┘        app/ ──► features/* + core/*   (composition root)
```

1. `features/*/domain/**` ห้าม import flutter / dio / omnistock_api_client / riverpod (pure Dart)
2. `core/**` ห้าม import `features/**`
3. `omnistock_api_client` import ได้เฉพาะ `features/*/data/**` + `core/api/**`
4. feature ห้าม import feature อื่น — ข้าม feature ผ่าน `core/session` / `core/events` เท่านั้น
5. `domain/` ห้ามพึ่ง layer อื่นของ feature ตัวเอง (dependency ชี้เข้าใน)
6. **(ใหม่)** `features/**` + `core/**` ห้าม import `app/**` — `app/` เป็นผู้ประกอบฝ่ายเดียว
7. **(ใหม่)** `features/*/presentation/**` ห้าม import `core/api/**` ตรง ๆ (จอห้ามยิง HTTP เอง — ต้องผ่าน controller→repo)

---

## §3 Key patterns (พร้อม code sketch)

### 3.1 Read path มาตรฐาน: `AsyncNotifier` + 4 states ได้ฟรี

ทุก "จออ่านข้อมูล" ใช้รูปเดียว: controller เป็น `AutoDisposeAsyncNotifier` (หรือ `...Family` เมื่อมี id) —
`AsyncValue` ให้ loading/error/data ในตัว; ความ "empty" เป็นการตีความของ data → wrapper กลางบังคับครบ 4:

```dart
// core/async/async_state_view.dart — บังคับ design-system §2 ทุกจอโดยไม่ต้องจำ
class AsyncStateView<T> extends StatelessWidget {
  const AsyncStateView({
    required this.value,          // AsyncValue<T>
    required this.data,           // Widget Function(T)
    required this.onRetry,
    this.isEmpty,                 // bool Function(T)? — list ว่าง ฯลฯ
    this.empty,                   // Widget? — EmptyState + CTA (copy จาก i18n)
    this.skeleton,                // Widget? — default: Skeleton มาตรฐาน
  });
  // build(): loading → Skeleton · error → ErrorBanner(failureMessage(e)) + ปุ่มลองใหม่
  //          data ∧ isEmpty → empty · ไม่งั้น → data(value)
}
```

- **Cache/invalidation convention:** ทุก read provider เป็น `autoDispose` + `ref.cacheFor(duration)`
  (extension ใน `core/async` ที่ถือ `keepAlive()` link แล้วปล่อยตาม timer) — default 2 นาที;
  จอที่ realtime สำคัญ (orders) พึ่ง event invalidation (§3.5) ไม่ใช่ cache สั้น
- ไม่เอา query-cache library เพิ่ม (เช่น fquery): Riverpod ครอบคลุม fetch/cache/invalidate/refresh แล้ว —
  dependency เพิ่ม 1 ตัวต้องจ่ายค่า new-dep gate + สอน agent อีก pattern โดยไม่ได้อะไรที่ทำเองไม่ได้ใน ~30 บรรทัด

### 3.2 Session/org context: org-scoped Dio — B1/D5 แก้ที่ระดับโครงสร้าง ไม่ใช่วินัย

**ปัญหา:** "ทุก provider ต้องจำว่า watch activeOrg" = วินัยที่ agent จะหลุดสักวัน (design-brief B1: ต้อง "ลืมแล้วพัง")

**ทางเลือกที่เทียบ:**
- (ก) ทุก data provider `watch(activeOrgIdProvider)` เองด้วยมือ — convention ล้วน ตรวจอัตโนมัติยาก → ตกรอบ
- (ข) `ProviderScope` ซ้อนต่อ org (nuke ทั้ง subtree ตอน switch) — แรงพอ แต่ scope ซ้อนทำ override/เทสต์ยุ่งขึ้นทุกจุด และ break pattern ปกติของ Riverpod → ตกรอบ
- **(ค — เลือก) org-scoped Dio/ApiClient provider:** client API ที่ feature ใช้ **derive จาก active org โดยโครงสร้าง**

```dart
// core/api/api_providers.dart
final baseDioProvider = Provider<Dio>((ref) => buildBaseDio(ref));      // auth, org list — ไม่ผูก org

final orgDioProvider = Provider<Dio>((ref) {
  final orgId = ref.watch(activeOrgIdProvider);                          // ← หัวใจ: dependency เชิงโครงสร้าง
  if (orgId == null) throw StateError('no active org — route guard ต้องกันมาก่อนแล้ว');
  return buildBaseDio(ref)..options.headers['X-Organization-Id'] = orgId;
});

// features/stock/data/stock_repository_impl.dart — repo สร้างจาก orgDio เท่านั้น
final stockRepositoryProvider = Provider<StockRepository>(
  (ref) => StockRepositoryImpl(StockApi(ref.watch(orgDioProvider), serializers)),
);
```

ผลลัพธ์: (1) **ลืมแนบ org ไม่ได้** — ไม่มีทางได้ client โดยไม่ผ่าน `orgDioProvider`
(2) **org switch = เขียน `activeOrgIdProvider` ตัวเดียว** → Riverpod rebuild ทั้ง graph ที่พึ่ง orgDio
(repo → controller → widget) โดย state เก่าถูกทิ้ง (autoDispose) — ไม่มี leak ข้าม org โดยไม่ต้องไล่ invalidate รายตัว
(3) endpoint org-agnostic ใช้ `baseDioProvider` แยกชัด — ตรวจด้วยตาใน review ง่าย (มี 2 ตัวเท่านั้น)

`core/session` ถือ state ชั้นเดียว:

```dart
// core/session/session_state.dart (sealed) — router guard + ทุก feature อ่านจากนี่
sealed class SessionState {}
class SessionUnknown    extends SessionState {}                    // bootstrap ยังไม่จบ
class SessionNone       extends SessionState {}                    // → login
class SessionAuthed     extends SessionState {                     // login แล้ว
  final List<OrgSummary> orgs;
  final ActiveOrg? active;         // null = ยังไม่เลือก org → org picker
}
class SessionForceUpdate extends SessionState {}                   // 426 → จอบังคับอัปเดต

class ActiveOrg {                  // cache หลัง login/switch (F-003 + F-007)
  final String orgId;
  final Set<String> capabilities;  // RBAC — can()
  final Entitlements entitlements; // tier — entitled()
}
```

interceptor 401-terminal / 403-revoked / 426 ยิงเข้า `SessionController` (core/api → core/session ได้ — ทั้งคู่ core)
→ router redirect ทำงานเอง (§3.3)

### 3.3 Navigation, guards, gating (go_router)

**เลือก go_router** (เทียบ auto_route: codegen build_runner เพิ่ม ทั้งที่ D-023 ตั้งใจเลี่ยง codegen;
เทียบ Navigator ดิบ: ไม่มี declarative redirect/deep-link table ที่ backlog ต้องใช้) —
go_router เป็น package ทีม Flutter ดูแล, redirect-based guard ตรงกับ SessionState แบบ sealed พอดี
(new dependency → ขออนุมัติที่ F-006 Gate 2 ตาม new-dep gate)

```dart
// app/router.dart — guard chain เดียว อ่าน session เท่านั้น
GoRouter buildRouter(Ref ref) => GoRouter(
  refreshListenable: ref.sessionListenable(),           // session เปลี่ยน → re-evaluate redirect
  redirect: (ctx, state) {
    final s = ref.read(sessionControllerProvider);
    return switch (s) {
      SessionUnknown()          => '/bootstrap',
      SessionForceUpdate()      => '/force-update',
      SessionNone()             => state.isPreAuth ? null : '/login',
      SessionAuthed(active: null) => '/select-org',
      SessionAuthed()           => _guardCapability(s, state),   // route metadata: requiredCapability / requiredFeature
    };
  },
  routes: [...authRoutes, ...orgRoutes, ...stockRoutes, ...],    // feature ละ list — additive (A3)
);
```

- แต่ละ feature export `List<GoRoute> xxxRoutes` จาก `presentation/routes.dart` — `app/router.dart` เป็นคน import
  (rule 6: features ไม่รู้จัก app) · route ประกาศ `requiredCapability` / `requiredFeature` เป็น metadata
- **Widget-level gating** ใช้ provider เดียวกับ router:

```dart
final canProvider = Provider.family<bool, String>((ref, cap) =>
    ref.watch(activeOrgProvider).capabilities.contains(cap));          // B3 — RBAC
final entitledProvider = Provider.family<bool, String>((ref, feature) =>
    ref.watch(activeOrgProvider).entitlements.has(feature));           // B2 — tier

// core/ui/feature_gate.dart — design-system §5: tier ไม่มี → โชว์+ล็อก+ปุ่มอัปเกรด (ไม่ซ่อน)
FeatureGate(feature: 'accounting', child: DocumentListScreen());
// RBAC ไม่มีสิทธิ์ → ซ่อน/disable (คนละ semantics — B2 กับ B3 ไม่ปนกัน)
```

- **Deep link scheme (D6):** `omnistock://o/<orgId>/<path>` เช่น `omnistock://o/org_123/orders/ord_456`
  push payload ใส่ URI นี้ · router guard: ถ้า `orgId != activeOrg` → เก็บ pending URI, สลับ org
  (มี confirm ถ้ามี dirty form) → navigate ต่อ — จอปลายทางไม่ต้องรู้เรื่องนี้เลย
- client ซ่อน/ล็อก = UX เท่านั้น — **server enforce เสมอ** (F-006 US-4); 403 จาก server → ForbiddenFailure → copy กลาง

### 3.4 Networking: interceptor chain + error taxonomy

Dio ตัวเดียว (ต่อ scope §3.2) กับ interceptor เรียงลำดับ (ทุก feature ได้ฟรี — ไม่ re-derive ต่อ feature):

```
HttpsGuard → AuthTokenInterceptor (แนบ access จาก TokenStore)
           → OrgHeaderInterceptor (อยู่ใน orgDio แล้ว)
           → RefreshInterceptor (QueuedInterceptor: 401 → single-flight refresh ผ่าน RefreshCoordinator
                                 → queue request อื่นระหว่าง refresh → retry once → terminal 401 = SessionNone)
           → RetryInterceptor (เฉพาะ method idempotent: GET/HEAD · max 2 · backoff 400ms→1.6s + jitter
                               · เคารพ Retry-After · ห้าม auto-retry write ทุกชนิด)
           → ErrorMappingInterceptor (DioException/ErrorResponse → ApiFailure)
```

- **ย้าย refresh จาก per-repository ไป interceptor:** ปัจจุบัน `requestWithRefresh()` เป็น wrapper ที่ repo
  ต้องเรียกเอง (เสี่ยงลืมใน feature ที่ 10) — F-006 ยกเป็น `QueuedInterceptor` เพื่อได้ทั้ง "ลืมไม่ได้"
  และ AC "queue request ระหว่าง refresh" (US-1) · `RefreshCoordinator`/`RefreshOutcome` เดิม reuse ได้ตรง ๆ
- **Timeout budget:** connect 5s · receive 15s (default) · งานยาว (import/รายงาน) ห้ามรอ HTTP — เป็น job
  ฝั่ง server แล้ว client poll สถานะ
- **Error taxonomy (B6):**

```dart
// core/error/api_failure.dart — sealed: switch ครบทุกกรณีถูกบังคับโดย compiler
sealed class ApiFailure implements Exception { const ApiFailure(); }
class NetworkFailure     extends ApiFailure {}                          // SocketException/timeout → "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
class ThrottledFailure   extends ApiFailure { final int retryAfterSeconds; } // 429 → ThrottleBanner
class AuthExpiredFailure extends ApiFailure {}                          // refresh แล้วยัง 401 → session over
class ForbiddenFailure   extends ApiFailure { final String? code; }     // 403 RBAC → "ไม่มีสิทธิ์..."
class EntitlementFailure extends ApiFailure { final String? feature; }  // 403 tier → CTA อัปเกรด
class ValidationFailure  extends ApiFailure { final String? code; final Map<String, String> fieldErrors; }
class ConflictFailure    extends ApiFailure { final String? code; }     // 409 — เช่น เอกสารเลขรันชน
class NotFoundFailure    extends ApiFailure {}
class ServerFailure      extends ApiFailure {}                          // 5xx → "ระบบขัดข้องชั่วคราว"
class ForceUpdateFailure extends ApiFailure {}                          // 426/APP_UPDATE_REQUIRED → SessionForceUpdate

// core/error/failure_messages.dart — mapping กลาง failure → i18n key (ไทย)
// feature เติม mapping เฉพาะทางได้ (เช่น auth: enumeration-safe 401) แต่ fallback กลางมีเสมอ
// ห้าม render machine code ให้ user เด็ดขาด
String failureMessage(AppLocalizations t, ApiFailure f) => switch (f) { ... };
```

controller จับ `on ApiFailure` แบบ typed — ไม่มี `catch (e)` แล้วเดา status ต่อ feature อีก
(แทน `ApiError` เฉพาะ auth เดิม ซึ่งจะถูก generalize เป็น taxonomy นี้)

### 3.5 Cross-feature reactions: typed AppEvent bus (D2, D6)

feature ห้าม import กัน (rule 4) — การสื่อสารข้าม feature ใช้ event กลางใน `core/events`:

```dart
// core/events/app_events.dart
sealed class AppEvent { const AppEvent(); }
class OrderChanged   extends AppEvent { final String orgId; final String? orderId; }
class StockChanged   extends AppEvent { final String orgId; final String? inventoryItemId; }
class SyncHealthChanged extends AppEvent { final String orgId; }
class NotificationArrived extends AppEvent { final String orgId; final String deepLink; }

final appEventBusProvider = Provider((ref) => AppEventBus());   // StreamController.broadcast ห่อบาง ๆ

// ผู้ฟัง (orders list controller):
ref.listenAppEvent<OrderChanged>((e) => ref.invalidateSelf());  // extension ใน core/events
```

- **ผู้ยิง:** `core/push` (push มาถึง foreground/background-tap) · หลัง mutation สำเร็จ (controller ยิง
  `StockChanged` ให้จออื่นของ "feature เดียวกันหรือคนละ feature" refresh) · foreground poll เบา ๆ ในจอที่เปิดอยู่
- push tap → `NotificationArrived(deepLink)` → router จัดการ org-switch + navigate (§3.3)
- ตัดสินใจ: **ไม่ทำ WebSocket/stream จริงตอนนี้** — backlog ไม่มี requirement hard-realtime;
  push-driven invalidation + poll-on-focus ครอบ D2 ที่ราคาถูกกว่า มาก (seam: ถ้าอนาคตมี stream ก็ยิงเข้า bus เดิม)

### 3.6 Hardware ports (D7), i18n, formatting

```dart
// core/hardware/barcode_scanner_port.dart — logic ไม่รู้จัก plugin
abstract class BarcodeScannerPort {
  Stream<String> scan();            // เปิดกล้อง/เครื่องอ่าน → ยิง code ที่อ่านได้
}
abstract class CameraCapturePort { Future<CapturedImage?> capture(); }   // ถ่ายบิล F-040
abstract class LabelPrinterPort  { Future<void> printPdf(Uint8List pdf); } // F-050 (label มาจาก server เป็น PDF)
```

impl จริง (plugin: `mobile_scanner`, `image_picker`, print/share sheet) อยู่ `core/hardware/impl/` และ
ถูก override ใน `bootstrap.dart` — widget/controller test ใช้ fake port เสมอ (B8) · เลือก plugin จริงตอน
Gate 2 ของ feature นั้น ๆ (F-093/F-040/F-050) — เอกสารนี้ล็อกแค่ "รอยต่อเป็น port ใน core"

**i18n (D8/B6):** ย้ายจาก const class (`AuthTh`) → **Flutter gen_l10n + ARB** (`core/l10n/app_th.arb`, `app_en.arb`)
- เหตุผลเทียบ const class เดิม: F-006 AC บังคับ "สลับภาษาใน settings + อังกฤษเติม progressive" —
  const class ต้องทำ locale plumbing เอง; gen_l10n เป็นของ built-in ใน flutter tool (**ไม่เพิ่ม build_runner**)
  ได้ MaterialLocalizations/format ไทยครบ และ key ที่ยังไม่มีคำแปล en ก็ fallback th ได้ตามนโยบาย
- convention: key ขึ้นต้นด้วย feature (`stockAdjustTitle`) — ไฟล์ ARB กลางแต่ prefix กันชนกัน · copy = ของ ux
- **`core/format`:** เงิน `"฿1,250.00"` (สอง ตำแหน่ง, คั่นหลักพัน — **display เท่านั้น**, ห้ามคำนวณ),
  วันที่ `"23 มิ.ย. 2026, 14:30"` (UTC → Asia/Bangkok ที่จุด format เดียว), จำนวน + classifier ("12 รายการ"),
  เลข tabular ใน widget ที่วิ่ง (countdown) — ทุกจอเรียกจากนี่ ห้าม format มือ (B5)

### 3.7 Form pattern (D4)

- state ฟอร์ม = `Notifier<XxxFormState>` (ไม่ใช่ setState กระจาย) — copyWith + field error map
- validation rule ฝั่ง client (รูปแบบ/ความยาว/required — mirror ของ server ไม่ใช่ตัวแทน) เป็น **pure function ใน `domain/validation.dart`** → `dart test` ตรง ๆ (exemplar: auth)
- submit: pessimistic — ปุ่ม disabled + skeleton/spinner ระหว่างส่ง · `ValidationFailure.fieldErrors`
  จาก server map กลับลง field เดียวกับ client-side error (ผู้ใช้ไม่รู้ว่าใครเป็นคนด่า)
- ฟอร์มเงิน/สต๊อก: input เป็น string/int เท่านั้น ส่ง raw ให้ server ตัดสิน — ไม่มี Decimal math บน client

---

## §4 Performance & offline strategy

### 4.1 List 1k–10k (D3)

- **Pagination convention เดียวทั้งระบบ** (ตาม contract ของ backend-api): cursor-based
  `?cursor=&limit=` + `{ items, nextCursor }` — mobile ทำ infinite scroll เสมอ ไม่โหลดทั้งก้อน
- `core/async/paged_list_controller.dart` — generic ตัวเดียวใช้ทุก list:

```dart
abstract class PagedListController<T> extends AutoDisposeAsyncNotifier<PagedList<T>> {
  Future<Page<T>> fetchPage(String? cursor);       // feature implement แค่นี้
  Future<void> loadMore();                          // กัน double-fire, append, error-of-more ≠ error-of-page-1
  Future<void> refreshAll();                        // pull-to-refresh → cursor = null
}
// คู่กับ core/ui/paged_list_view.dart: ListView.builder + scroll threshold + item skeleton
// + separator + empty/error ครบ 4 states — จอ list ใหม่เหลือแค่ให้ itemBuilder
```

- discipline: `ListView.builder` เท่านั้น (ห้าม `Column`+map) · row เป็น `const`-able widget แยกไฟล์ ·
  รูปสินค้าเป็น **thumbnail จาก server** + `cached_network_image` (memCacheWidth ตรง DPR) ·
  page size 20–50 · search/filter ยิง server ไม่ filter หมื่นแถวบน client

### 4.2 Offline & เน็ตไม่นิ่ง (D1)

นโยบายแบ่ง 3 ระดับ ชัดว่าอะไรอยู่ระดับไหน:

| ระดับ | อะไรบ้าง | กลไก |
|---|---|---|
| **read-cache (in-memory)** | ทุกจอ | Riverpod + `cacheFor` — เปิดจอซ้ำใน 2 นาทีไม่ยิงใหม่ |
| **read-cache (persistent, stale-ok)** | จอ shell-critical: dashboard cards, product/stock list ล่าสุด, org list | `ReadCache` port ใน `core/offline` (KV: key = org+resource, value = json + fetchedAt) — แสดงของเก่า + badge "ข้อมูลเมื่อ HH:mm" แล้ว revalidate เบื้องหลัง · impl จริงค่อยเลือก (shared_preferences/hive) ตอน F-006/F-061 |
| **write-queue (outbox)** | **เฉพาะ F-093 stock take** (นับของหน้างาน) | `OutboxQueue` port ใน `core/offline` — จดรายการนับเป็น draft ในเครื่อง, กลับ online แล้ว **ผู้ใช้กดส่งเอง** เป็น ADJUST batch เดียว (ผ่าน ledger) — ไม่ replay อัตโนมัติเงียบ ๆ |

- **สิ่งที่ห้าม optimistic เด็ดขาด:** ทุก write ที่กระทบเงิน/สต๊อก (adjust, stock-in, เอกสาร, แพ็ค)
  — ต้องเห็นผลจริงจาก server (ledger เขียนสำเร็จ) ก่อน UI ยืนยัน · optimistic ได้เฉพาะของจิ๊บจ๊อย
  ไม่มีผลเงิน (เช่น mark notification read) และต้อง rollback ง่าย
- `connectivityProvider` + `OfflineBanner` กลาง — ทุกจอได้ฟรีจาก scaffold ของ shell
- transient vs terminal แยกชัดตั้งแต่ taxonomy (`NetworkFailure` ≠ `AuthExpiredFailure`) —
  bootstrap ปัจจุบันทำถูกแล้ว (`RefreshOutcome.transientFailure` ไม่ wipe token) — เก็บ invariant นี้ไว้ทุกจุด

### 4.3 ความจริงของโมเดลบนจอ (B4/B5)

- จอสต๊อกไม่มีปุ่ม "แก้จำนวน" — มีแต่ "บันทึกการเคลื่อนไหว" (ADJUST/PURCHASE_IN/...) → สอดคล้อง ledger
- `SellableSku.available` แสดงเป็นค่า computed จาก server (พร้อม refresh) — ไม่มี UI ที่ทำให้ดูเหมือน editable
- COGS/กำไร/ยอดเงินทุกตัว = string/ตัวเลขจาก server ผ่าน `core/format` — ไม่มีการบวกลบบน client

### 4.4 Startup & rebuild budget (D9)

- **Budget:** cold start → first frame (skeleton) ≤ 2s บน Android กลาง ๆ · → จอใช้งานได้ ≤ 3.5s
- ลำดับ bootstrap: first frame (skeleton) → อ่าน keychain → silent refresh 1 ครั้ง → load org context →
  จอแรก · **defer หลัง first frame:** push registration, entitlements re-fetch, cache warmup
- rebuild discipline: `ref.watch(provider.select((s) => s.field))` ในจอที่ state ใหญ่ ·
  controller แยกต่อจอ (ไม่มี god-state) · `const` constructor ทุก widget ที่ทำได้ (lint `prefer_const_*` เปิดอยู่แล้ว)
- ไม่มี heavy compute บน UI isolate — งานหนัก (parse ใหญ่) ไม่ควรมีอยู่แล้วเพราะ server ทำ; ถ้าจำเป็น `compute()`

---

## §5 Testing & enforcement

### 5.1 Test ต่อ layer (D-014 — ทุก implementation มีเทสต์ประกบ)

| Layer | วิธี | ห้าม |
|---|---|---|
| `domain/` | `dart test` เพียว — pure fn/entity | ไม่มี mock framework ก็ควรเทสต์ได้ |
| `data/` | repo impl + `FakeHttpClientAdapter` (มีอยู่แล้ว: `test/features/auth/data/fake_dio_adapter.dart` → ย้าย/ยกเป็น helper กลาง `test/support/`) — ยิง DTO จริงของ generated client | เครือข่ายจริง |
| `application/` | `ProviderContainer(overrides: [repoProvider.overrideWithValue(fake)])` — ทดสอบ transition ครบ (loading/error/success/throttle/org-switch) | widget |
| `presentation/` | widget test + `ProviderScope(overrides:)` — 4 states ต่อจอ + effect (focus/clear/navigate callback) | controller logic ซ้ำ |
| `app/router` | ทดสอบ redirect chain ด้วย session state ปลอมครบทุกกรณี (unknown/none/no-org/force-update/no-capability) | — |
| `core/*` | unit ตรง ๆ (interceptor: Dio + fake adapter · event bus · paged controller ด้วย fake fetch) | — |
| hardware/push/offline | เทสต์ผ่าน **fake port เสมอ** — CI ไม่มีกล้อง/keychain/FCM | plugin จริงใน test |

หลักเดิมของ D-023 คงไว้: **ไม่มีเทสต์ไหนแตะ network/keychain/hardware จริง** — integration จริงเป็น lane
manual/device แยก (F-061 ก่อนขึ้น store)

### 5.2 CI boundary gate (ต่อยอด `tool/check_boundaries.dart` เดิม)

ของเดิม (rule 1–5) เขียนดีและมีเทสต์พฤติกรรมครบ — **เพิ่ม**:

- rule 6: `features/**`, `core/**` ห้าม import `app/**`
- rule 7: `features/*/presentation/**` ห้าม import `core/api/**` (จอห้ามแตะ transport)
- **test-presence check:** ทุก `lib/features/<f>/` ต้องมี `test/features/<f>/` ที่ไม่ว่าง (กัน "feature ไม่มีเทสต์" หลุด merge — D-014)
- lane CI เดิมคง: `flutter analyze` + `flutter test` + boundary gate ต้องเขียวก่อน merge ·
  เพิ่ม lane เช็ค `api_client` ไม่ถูกแก้มือ (regen แล้ว diff ต้องว่าง) เมื่อ contract เปลี่ยน (E1)

### 5.3 New feature playbook — ตัวอย่าง F-013 (stock adjustment & ledger view)

ขั้นตอนที่ agent ทำตามได้โดยไม่ต้องตีความ:

```
1. อ่าน spec F-013 + contract (regen api_client ถ้า contract ใหม่: pnpm gen:contracts:dart)
2. สร้างโครง:
   lib/features/stock/
   ├── domain/
   │   ├── entities/stock_item.dart, stock_movement.dart      # entity — ไม่ใช่ DTO gen
   │   ├── repositories/stock_repository.dart                 # abstract contract
   │   └── validation.dart                                    # กติกาฟอร์ม adjust (qty ≠ 0, เหตุผล required)
   ├── data/
   │   └── stock_repository_impl.dart                         # แตะ generated StockApi ที่เดียว; DTO→entity;
   │                                                          #   สร้างจาก ref.watch(orgDioProvider) เท่านั้น
   ├── application/
   │   ├── stock_providers.dart                               # stockRepositoryProvider (typed เป็น abstract)
   │   ├── stock_items_controller.dart                        # PagedListController<StockItem> + listen StockChanged
   │   ├── movement_list_controller.dart                      # PagedListController<StockMovement> (family: itemId)
   │   └── adjust_stock_controller.dart                       # Notifier<AdjustFormState> — pessimistic submit;
   │                                                          #   สำเร็จ → ยิง StockChanged เข้า event bus
   └── presentation/
       ├── routes.dart                                        # stockRoutes (+requiredCapability: 'manage_stock')
       ├── screens/stock_list_screen.dart                     # PagedListView + AsyncStateView (4 states ฟรี)
       ├── screens/stock_detail_screen.dart                   # available = computed จาก server (read-only)
       ├── screens/adjust_stock_screen.dart                   # ฟอร์ม "บันทึกการเคลื่อนไหว" — ไม่ใช่ "แก้จำนวน"
       └── widgets/movement_tile.dart
3. เติม i18n key ใน core/l10n/app_th.arb (prefix stock…) — copy จาก ux
4. register: app/router.dart เพิ่ม ...stockRoutes (1 บรรทัด) — จบ จุดแตะของเก่ามีเท่านี้ (A3)
5. เทสต์ mirror ทุกไฟล์: domain(dart test) / data(fake adapter) / application(ProviderContainer)
   / presentation(widget 4 states) — ดู test/features/auth เป็น exemplar
6. รัน: fvm flutter analyze · fvm flutter test · fvm dart run tool/check_boundaries.dart → เขียวครบ
7. รายงานผลตามจริง (กฎ CLAUDE.md ข้อ 4)
```

---

## §6 Gap analysis vs โค้ดจริง (auth = feature เดียวที่ build แล้ว) + D-023

ภาพรวมที่ต้องพูดตรง ๆ: **D-023 + refactor ที่ทำไปแล้ว "ถูกทาง" และคุณภาพสูงเกินคาดสำหรับ Phase 0** —
โครง 4 ชั้น, boundary gate ที่จับ export/part ด้วย, token hygiene, transient-vs-terminal refresh,
enumeration-safe error — ของพวกนี้คือของจริง ไม่ต้อง rebuild อะไรเลย ช่องว่างทั้งหมดคือ
**ชั้นที่ยังไม่ถูกสร้าง** (session/org, router, push, offline, list infra) ซึ่ง D-023 ประกาศจองที่ไว้แล้ว
และ **2 จุดที่ต้อง refactor ก่อนจะกลายเป็น pattern ที่ถูกลอก 30 ครั้ง** (refresh per-repo, i18n const class)

| Area | สภาพปัจจุบัน | Verdict | เหตุผล | Effort |
|---|---|---|---|---|
| โครง feature-first 4 layers | ตรงตาม D-023, auth ครบ 4 ชั้น | **KEEP** | ตรงกับ design จากศูนย์ — ไม่ manufacture ความต่าง | — |
| Riverpod manual providers | ใช้แล้วทั้ง auth, override ได้ทุกชั้น | **KEEP** | ตอบ B8/D2/D5; codegen ยังไม่จำเป็น | — |
| Boundary gate (`tool/check_boundaries.dart`) | rule 1–5, จับ import/export/part, relative+package | **KEEP + เติม** | เพิ่ม rule 6–7 + test-presence check (§5.2) | S |
| `core/api/refresh_coordinator.dart` | generic, single-flight, RefreshOutcome ดี | **KEEP + REFACTOR การ wiring** | ตัว logic ถูก; แต่ `requestWithRefresh` เป็น per-repo wrapper — ต้องยกขึ้น Dio `QueuedInterceptor` (F-006 US-1 "queue ระหว่าง refresh") ไม่งั้น feature ที่ 2+ ต้องจำเรียกเอง | M (F-006) |
| Interceptor chain (auth attach / org header / retry / error map) | มีแค่ `https_guard`; auth repo แนบ token เอง per-call | **ADD** | หัวใจของ B1/B6/D1 — ทุก feature ต้องได้ฟรี | M (F-006) |
| Error taxonomy | `ApiError` (status+code) อยู่ใน `features/auth/data` + mapper per-flow ใน `core/error` | **REFACTOR → ADD** | generalize เป็น sealed `ApiFailure` กลาง (§3.4); mapper auth เดิมกลายเป็น layer เฉพาะทางซ้อนบน fallback กลาง — ทำก่อน F-013 ไม่งั้น auth pattern (per-feature error type) ถูกลอก | M (F-006) |
| Session/org context (`core/session`) | ไม่มี (D-023 จอง seam ไว้) — ไม่มี activeOrg, capabilities, entitlements | **ADD** | ฐานของ B1/B2/B3/D5/D6 — ใช้ org-scoped Dio pattern (§3.2) | L (F-002/006/007) |
| Router / navigation | `app.dart` = enum switch + `AuthFlow` Navigator มือ (คอมเมนต์ระบุเองว่าเป็น standalone proof รอ F-006) | **ADD (go_router)** | จอ auth เป็น callback-based อยู่แล้ว → เสียบ router ได้โดยแทบไม่แก้จอ — การเตรียม seam ตรงนี้ทำไว้ดี | M (F-006) |
| Deep link + push plumbing (`core/push`) | ไม่มี | **ADD** | D6 + F-028; scheme `omnistock://o/<orgId>/...` + dispatch ผ่าน event bus | M (F-006/F-028) |
| Event bus (`core/events`) | ไม่มี | **ADD** | D2 + ทางเดียวที่ถูกกติกาในการคุยข้าม feature | S (F-006) |
| Offline (`core/offline`: connectivity, ReadCache, Outbox seam) | ไม่มี (มีแค่ transient-failure semantics ใน RefreshOutcome — ถูกทางแล้ว) | **ADD** | D1; Outbox เป็น port เปล่าจนถึง F-093 — อย่า build เกิน | M (F-006 บาง + F-093 เต็ม) |
| List/pagination infra (`core/async`: PagedListController, cacheFor, AsyncStateView) | ไม่มี | **ADD** | D3/D8 — ต้องมาก่อนหรือพร้อม F-013 (จอ list แรก) | M (F-013 Gate 2) |
| i18n | const class ต่อ feature (`core/i18n/auth_th.dart`), ไทยอย่างเดียว, ไม่มี locale switching | **REFACTOR → gen_l10n ARB** | F-006 AC บังคับสลับภาษา + en progressive; ย้าย key auth เข้า ARB เป็นงาน mechanical | M (F-006) |
| Theme/tokens (`app/theme/app_theme.dart`) | token 1:1 กับ design-system, ThemeData ครบ | **KEEP** | ตรง spec; dark mode เป็น F-061 ค่อยยก ThemeExtension ตอนนั้น | — |
| `core/ui` design-system widgets | Skeleton/ErrorBanner/Toast/ConfirmDialog/fields มีแล้ว | **KEEP + โต** | เติม EmptyState, OfflineBanner, FeatureGate, PagedListView ตาม feature ที่มาถึง | S/feature |
| `TokenStore` + `SecureStorage` | access=memory, refresh=keychain, wipe ครบ — ตรง client-security | **KEEP** | ★ อย่าแตะโดยไม่มี security review | — |
| Auth feature ทั้งก้อน | 4 ชั้นครบ, เทสต์ 127+ ครอบทุกชั้น, enumeration-safe, AutoDispose ถูกใช้อย่างมีเหตุผล | **KEEP (exemplar)** | คือแม่แบบของ playbook §5.3 | — |
| `authRepositoryProvider` typed เป็น `AuthRepositoryImpl` (concrete) | `Provider<AuthRepositoryImpl>` + controllers เรียก impl ตรง; abstract `AuthRepository` มีแต่แคบ (เฉพาะ bootstrap ใช้) | **REFACTOR (เล็ก)** | ขยาย abstract ให้ครบ surface แล้ว type provider เป็น abstract — กันโครง "provider ผูก concrete" ถูกลอกไป 30 features (ไฟล์เองก็ note ไว้ว่าเป็น mechanical follow-up) | S |
| `main.dart` / bootstrap | thin + `buildAppOverrides(baseUrl)` ไม่ hardcode env | **KEEP + โต** | เติม override ราย adapter (hardware/push/cache) ตาม feature | S/feature |
| pubspec deps | น้อยและตรงเหตุผล (riverpod, secure_storage, dio, built_value) | **KEEP** | เพิ่มราย feature ผ่าน new-dep gate: go_router, intl, connectivity_plus, cached_network_image, mobile_scanner, firebase_messaging | — |
| `docs/mobile-architecture.md` (D-023) | ถูกต้องแต่ครอบเฉพาะที่ตัดสินแล้ว — ประกาศชัดว่าไม่ตัดสิน router/offline/push | **KEEP เป็น decision record** | เอกสารนี้ (`docs/architecture/mobile.md`) เป็นภาพเต็ม; D-023 เป็นบันทึกการตัดสินใจฐาน | — |

**ไม่มีรายการ REBUILD** — จุดที่เสี่ยงสุดสองจุด (refresh wiring, error taxonomy) จับได้ก่อนที่จะมี feature
ที่สองมาลอก pattern จึงยังเป็น refactor ราคา M ไม่ใช่ rebuild

**ลำดับปิด gap ที่แนะนำ (ผูกกับ backlog เดิม ไม่สร้าง phase ใหม่):**
1. **F-006 Gate 2** = งานก้อนใหญ่ของเอกสารนี้: router+guards, interceptor chain (+ยก refresh), `ApiFailure`,
   `core/session` (โครง — เต็มเมื่อ F-002/F-007 backend พร้อม), event bus, gen_l10n migration, connectivity/ReadCache,
   push plumbing, boundary gate rule 6–7, ขยาย `AuthRepository` abstract
2. **F-013 Gate 2**: `PagedListController` + `AsyncStateView` + `PagedListView` (list infra กลางเกิดพร้อมจอ list แรก)
3. **F-007/F-003 mobile**: `can()`/`entitled()`/`FeatureGate` เต็ม
4. **F-093**: Outbox implementation จริง · **F-061**: perf budget วัดจริง + persistent cache ขัดเกลา + store polish

---

## §7 ร่าง guideline สำหรับ `apps/mobile/CLAUDE.md` (ให้ build agent ใช้แทนการอ่านเอกสารนี้ทั้งฉบับ)

> เนื้อหาด้านล่างคือ **ร่างที่จะไปแทนที่/merge กับ apps/mobile/CLAUDE.md ปัจจุบัน** เมื่อ F-006 ปิด gap แล้ว
> (ห้าม copy ไปก่อนของจริงมี — กติกาต้องตรงกับโค้ด ไม่ใช่ความหวัง) · ส่วน stack/คำสั่ง/FVM ของเดิมคงไว้

```markdown
## โครงสร้าง (อ่าน docs/architecture/mobile.md เมื่อสงสัยเหตุผล)

- feature ใหม่ = โฟลเดอร์ใหม่ใต้ lib/features/<f>/ 4 ชั้น: domain/ (pure Dart) · data/
  (ที่เดียวที่แตะ generated client) · application/ (Riverpod controllers) · presentation/
- exemplar: features/auth/ (โครง+เทสต์) · playbook เต็ม: docs/architecture/mobile.md §5.3
- จุด register ของ feature มี 3 ที่เท่านั้น: app/router.dart (routes) · core/l10n/*.arb (copy)
  · app/bootstrap.dart (override adapter จริง ถ้ามี)

## กฎเหล็ก (boundary gate จับ — รันก่อนส่งงานเสมอ: fvm dart run tool/check_boundaries.dart)

1. domain/ ห้าม import flutter / dio / omnistock_api_client / riverpod
2. core/ ห้าม import features/ · ทุกไฟล์ห้าม import app/ (ยกเว้น main.dart)
3. generated client แตะได้เฉพาะ features/*/data/ + core/api/
4. ห้าม import ข้าม feature — คุยข้าม feature ผ่าน core/session (state) หรือ core/events (event) เท่านั้น
5. presentation/ ห้าม import core/api/ — จอห้ามยิง HTTP เอง ต้องผ่าน controller → repository

## Pattern บังคับ

- **API client:** repository สร้างจาก `ref.watch(orgDioProvider)` เท่านั้น (org header + refresh + retry
  + error mapping ได้ฟรี) — endpoint ที่ไม่ผูก org (auth, org list) เท่านั้นที่ใช้ baseDioProvider
- **Read:** controller = AutoDisposeAsyncNotifier + ref.cacheFor() · จอ list ใช้ PagedListController +
  PagedListView · ทุกจอ render ผ่าน AsyncStateView → ได้ 4 states (skeleton/empty/error/data) ครบเสมอ
- **Mutation เงิน/สต๊อก = pessimistic เสมอ** — ห้าม optimistic, ห้ามคำนวณเงิน/สต๊อกบน client,
  จอสต๊อกคือ "บันทึก movement" ไม่ใช่ "แก้ตัวเลข" · mutation สำเร็จ → ยิง AppEvent ที่เกี่ยว
- **Error:** จับ `on ApiFailure` แบบ typed · ข้อความผู้ใช้มาจาก failureMessage()/i18n เท่านั้น —
  ห้าม render code/raw message จาก server
- **Gating:** ปุ่ม/จอ ตาม role ใช้ can('capability') (ซ่อน/disable) · ตาม tier ใช้ FeatureGate
  (โชว์+ล็อก+อัปเกรด — ห้ามซ่อน) · route ประกาศ requiredCapability/requiredFeature — server enforce เสมอ
- **i18n:** copy ทุกตัวเป็น key ใน core/l10n/app_th.arb (prefix ชื่อ feature) — copy เป็นของ ux ห้ามแต่งเอง
- **format:** เงิน/วันที่/จำนวน ผ่าน core/format เท่านั้น (฿1,250.00 · 23 มิ.ย. 2026, 14:30 · "12 รายการ")
- **hardware/push/storage:** ใช้ port จาก core/hardware / core/push / core/storage — ห้ามเรียก plugin ตรง
- **theme:** ใช้ AppColors/AppSpacing/AppRadius/AppTypography เท่านั้น — ห้าม hardcode สี/ระยะ
  (token ขาด → แจ้ง @ux ห้ามเลือกค่าเอง)

## เทสต์ (D-014 — ไม่มีข้อยกเว้น)

- ทุกไฟล์ implement มีเทสต์ mirror ใน test/ ชั้นเดียวกัน: domain=dart test เพียว ·
  data=FakeHttpClientAdapter · application=ProviderContainer(overrides) · presentation=widget test
  ครบ 4 states — ห้ามมีเทสต์แตะ network/keychain/กล้อง/FCM จริง
- ผ่านครบสามอย่างก่อนส่งงาน: fvm flutter analyze · fvm flutter test · boundary gate — รายงานผลตามจริง

## ห้ามตัดสินเอง (escalate)

- contract/endpoint/shape → backend-api · flow/copy/token → ux · scope/AC → product
- ★ task (token/auth/deep link/sensitive) → ทำตาม client-security skill + security-reviewer pass
```

---

*อ้างอิง: [design-brief.md](design-brief.md) · [docs/mobile-architecture.md (D-023)](../mobile-architecture.md) ·
[docs/06-clients.md](../06-clients.md) · [docs/design-system.md](../design-system.md) ·
[F-006](../features/F-006-mobile-app-shell.md) · โค้ดจริง `apps/mobile/lib/**` @ 0e5b3c1*
