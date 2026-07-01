# Forward-Commitments Register (กันตกหล่น)

รวมทุกข้อที่เราตัดสิน **"seam now, build later"** — map ว่า feature/phase ไหนต้อง build + seam ที่วางไว้แล้ว
(พิสูจน์ว่าไม่หลุด) · **append ทุกครั้งที่ตัดสินใจ "เลื่อนไว้ก่อน"**

> วิธีใช้: ก่อนเปิด build feature ปลายทาง (เช่น F-080) → เช็ค section ของมันที่นี่ก่อน = ไม่มีอะไรหลุด

---

## → F-024 / F-026 / F-030 (Phase 1 — ตอน build จริง)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Order financial fields (platformFee/ค่าส่ง mapping ราย connector) | F-024 ดึง field มา · กำไรหลังหักค่าช่องทาง |
| "กำไรโดยประมาณ — settle ทีหลัง" + ปรับตอนคืนสินค้า | F-026 returns ผูกกับ margin |

## → F-040 / F-042 / F-043 (Phase 2 — Full tier accounting)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| เอกสารซื้อ: file attachment + generator **ใบรับรองแทนใบเสร็จ** | tag ใน F-040 · storage lifecycle-ready |
| จัดกลุ่มเอกสารใหม่: ใบรับรองแทนใบเสร็จ/ใบสำคัญจ่าย = **ฝั่งซื้อ** (ย้ายจาก F-042) | flag data-model ตอน F-040 Gate 2 |
| Input VAT timing (ใบกำกับ supplier มาคนละจังหวะ/ยอด) | F-040/F-043 Gate 2 |
| read/write gate ของ accounting (downgrade ดูได้ เขียนไม่ได้) | F-007 `can(org,'accounting','read/write')` |

## → F-004b (Phase 2 — Tax settings, Full tier)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| VAT/WHT config, tax handling ราย channel | F-004 structure + F-002 tax profile (TIN) |
| **เลขรันเอกสารภาษี** (atomic sequence ไม่ซ้ำ/ไม่ขาด, prefix template, reset รายปี) | flag correctness ไว้แล้ว |

## → F-080 (Phase 5 — Billing)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Provisioning จาก license ที่ซื้อ (แทน seed) | F-007 รับ "provisioning source" |
| Static cap **ค่าจริง** + "เต็มโควต้า → อัปเกรด" | F-007 `canAdd()` path พร้อม |
| Paywall/อัปเกรด UI จริง (เนื้อหา+CTA) | F-007 `<FeatureGate>` wrapper พร้อม |
| Downgrade flow + **บล็อกถ้างวดภาษีค้าง** | F-007 ตั้งกฎ "ไม่ลบ + gate write" แล้ว |
| Storage retention **automation** (90วัน grace timer + export ZIP + cold-archive job) | F-007 policy + F-000 lifecycle-ready |
| Add-on **billing** (ซื้อ add-on) | F-007 itemized grants + source |
| Audit retention automation (archive security events ตามอายุ) | F-005 policy + append-only model |

## → F-082 (Phase 5 — Plan/Entitlement admin)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Plan/package management UI + grandfathering + override UI | F-007 data model + mutation ops (internal API) |

## → F-083 (Phase 5 — Metering)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Usage metering (immutable ledger) + quota counting + hard cap | F-007 features map รับ metered key |
| Metered storage / metered add-on (เครดิต AI ฯลฯ) | `storage_mb` key + grants seed |

## → F-085 (Phase 5 — Back-office console)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Super-admin config entitlement/plan/usage/support (UI) | F-007 mutation = internal API ให้ console ทับ |
| Super-admin actor + cross-org access **เปิดใช้จริง** | F-003 US-8 cross-org seam + F-005 audit |

## → F-081 (Phase 5 — Onboarding) + email infra
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| **Sync→Full upgrade wizard** (แยก tax entity: ร้าน/สต๊อกที่ไม่ใช่ TIN นี้ต้องย้าย license) | จุดยากที่ระบุไว้ชัด |
| Self-serve password reset (เมื่อมี SMTP) | F-001 admin-reset ก่อน · `verified` flag |
| Email verification | F-001 `verified=false` flag ติดไว้ |
| **Email sending infra (SMTP)** — ปลดล็อก reset+verify+notification | track เป็น infra dependency (devops) |

## → F-061 (Phase 4 — Mobile public release & polish)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Biometric app-lock | F-006 session/lock architecture พร้อมรับ |
| Full offline-write sync (offline DB + conflict resolution) | F-006 graceful degradation + cache read |
| Deep-link เต็ม, store submission/assets, perf polish, dark mode | F-006 navigation/push routing พื้นฐาน |

## → F-090+ (Phase หลัง — Multi-warehouse)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| CRUD หลาย warehouse + ตั้ง default หลายอัน | schema `Warehouse`/`StockLevel` per-warehouse · Phase 0 = default คลังเดียว |
| **TRANSFER** (โอนสต๊อกข้ามคลัง) + allocation ราย warehouse | `StockMovement.type=TRANSFER` มีใน enum แล้ว |

## → Phase หลัง (i18n)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| เติมคำแปล **อังกฤษ** ให้ครบทุกจอ (web+mobile) | i18n framework + key + Thai ครบ (F-006/web) |

## → Productize / Hardening (Phase 5+)
| สิ่งที่เลื่อน | seam ที่วางแล้ว |
|---|---|
| Phone + OTP identifier (phone-first) + SMS provider | F-001 `identifier + type` นามธรรม |
| 2FA/MFA, social login, SSO, CAPTCHA, passwordless | F-001 scope-out |
| ลบ org / โอนขาดเจ้าของเต็ม / seat limit enforce | F-002 scope-out |
| Custom role ละเอียด (per-field/record, per-warehouse scope), approval workflow | F-003 scope-out |
| Audit tamper-evidence (hash chain) | F-005 append-only model |

## → F-000 / devops (Phase 0 — infra)
| สิ่งที่เลื่อน | หมายเหตุ |
|---|---|
| Object storage: แยก prefix ราย org + **lifecycle-ready** | เงื่อนไขให้ retention/archive ทำงานได้ |

## → deferred จาก F-000 (D-004 · Gate 1 sign-off 2026-07-02)
| สิ่งที่เลื่อน | ปลายทาง build | seam ที่ F-000 วางแล้ว |
|---|---|---|
| Dart OpenAPI client **green/compile** | **F-006** (mobile shell) | F-000 wire Dart codegen pipeline (AC11) |
| Object storage **concrete backend** (local/minio → prod) | **F-040** (attachment) | F-000 วาง stub interface + org-prefix seam |
| **transaction+ledger write primitive** (write-in-tx + StockMovement) — กฎทอง 5 | **F-011** (inventory + ledger) | F-000 วาง trigger (AC8) + schema; helper define ตอน write จริง |
