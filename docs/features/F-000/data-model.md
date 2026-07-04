---
doc: F-000 data-model — concrete Prisma schema for all Gate-1 §2.2 tables (schema-only)
owner: "@backend-api"
signoff: approved
---

# F-000 — Data Model (Gate 2)

> Authoritative model = [docs/01-data-model.md](../../01-data-model.md) §2. This
> file makes it concrete Prisma. Scope = [F-000-project-setup.md](../F-000-project-setup.md)
> §2.2 (every table listed) with the schema-vs-logic rule §2.1 and D-004 resolutions.
> Architecture / typing / trigger / seam rationale = [architecture.md](./architecture.md).

**This is F-000's contract.** It is **schema-only**: tables + columns + enums +
unique + FK + indexes. **No computed/generated columns for derived values**
(`available`, `onHand−reserved`, weighted-average, COGS, resolved entitlement).
`StockMovement.balanceAfter` is a stored audit snapshot, not derived (spec §2.1).

## Conventions (apply to every model)
- `id String @id @default(cuid())`, `createdAt DateTime @default(now())`,
  `updatedAt DateTime @updatedAt` (ledger tables: `createdAt` only, no `updatedAt` —
  they are immutable, architecture §2).
- **Money = `Decimal @db.Decimal(18, 4)`** (Postgres `numeric`). Never `Float`.
- **Stock / quantity = `Int`** (Postgres `integer`).
- **`organizationId` on every domain table.** Allowlist that intentionally omits it
  (per AC6): **`User`, `Channel`, `PlanDefinition`, `RefreshToken`**. `Role` and
  `Invitation` **carry `organizationId`** (they are per-org; see notes) — flagged for
  qa AC6 confirmation.
- Every `organizationId` gets `@@index([organizationId])` (multi-tenant read path) in
  addition to any composite index shown.
- **Stub-structure vs fully-specified** is marked per model. Stub = real columns/FK/
  constraints present (so FKs don't float and F-000 introspection passes) but
  intentionally minimal; downstream feature fleshes out semantics.

### Enums

```prisma
enum MembershipStatus { active invited revoked }
enum InvitationStatus { pending accepted expired }
enum ProductStatus    { active archived }

enum StockMovementType {
  PURCHASE_IN
  SALE_OUT
  ADJUST
  TRANSFER      // explicitly included (spec: "Enums needed … incl TRANSFER")
  RETURN
  ASSEMBLY
}

enum ChannelKey        { shopee lazada tiktok }
enum ChannelAccountStatus { active expired revoked }        // stub — expand in F-004/F-005
enum ChannelListingStatus { active inactive error }         // externalStatus stub
enum AllocationMode    { FULL BUFFER FIXED DYNAMIC }
```

> `refType` on `StockMovement`/`UsageEvent` is kept as a **`String`**, not an enum:
> ref sources are open-ended (`ORDER`, `PURCHASE`, `ADJUSTMENT`, `SYNC`, `AI`, …) and
> adding a source must not require a migration. Same open-ended philosophy as
> `PlanDefinition.features`/`UsageEvent.meter`.

---

## Tenancy & Auth

### User — **fully specified** · allowlist: NO `organizationId`
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  verified     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  memberships   Membership[]
  refreshTokens RefreshToken[]
}
```
> Auth identity is org-agnostic (docs/01 §1): a user joins orgs via `Membership`.
> No `organizationId` by design (AC6 allowlist).

### Organization — **fully specified (core cols); taxProfile stub**
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  logo      String?
  timezone  String   @default("Asia/Bangkok")
  currency  String   @default("THB")

  // taxProfile — STUB (nullable, flattened). Enforced/validated when Full tier opens (F-007/accounting).
  taxEntityType   String?   // "personal" | "company"
  taxId           String?   // 13-digit TIN — 1 org = 1 TIN
  vatRegistered   Boolean?  
  taxBranchCode   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships   Membership[]
  roles         Role[]
  invitations   Invitation[]
  products      Product[]
  sellableSkus  SellableSku[]
  inventoryItems InventoryItem[]
  bundleComponents BundleComponent[]
  warehouses    Warehouse[]
  stockLevels   StockLevel[]
  stockMovements StockMovement[]
  channelAccounts ChannelAccount[]
  channelListings ChannelListing[]
  entitlement   OrgEntitlement?
  usageEvents   UsageEvent[]
}
```

### Membership — **fully specified**
```prisma
model Membership {
  id             String           @id @default(cuid())
  organizationId String
  userId         String
  roleId         String
  status         MembershipStatus @default(invited)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  user         User         @relation(fields: [userId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])

  @@unique([organizationId, userId])   // one membership per user per org
  @@index([organizationId])
  @@index([userId])
  @@index([roleId])
}
```
> Deactivate = set `status = revoked`, never delete (docs/01 §1).

### Role — **fully specified** · HAS `organizationId` (per-org, D-004)
```prisma
model Role {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  isSystem       Boolean  @default(false)   // Owner locked
  capabilities   String[]                    // capability registry (open-ended)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id])
  memberships  Membership[]
  invitations  Invitation[]

  @@unique([organizationId, name])
  @@index([organizationId])
}
```
> Roles are per-org editable (docs/01 §1) → carries `organizationId`. **NOT** in the
> AC6 no-org allowlist. Flagged for qa AC6 confirmation.

### RefreshToken — **fully specified** · allowlist: NO `organizationId`
```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  deviceId    String?
  rotatedFrom String?                        // previous token id — rotation chain
  revokedAt   DateTime?                       // reuse-detection revoke
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([rotatedFrom])
}
```
> Bound to `User`, not org (auth is org-agnostic) → AC6 allowlist. Rotation + reuse
> detection semantics land in F-001; F-000 ships the structure only.

### Invitation — **fully specified** · HAS `organizationId`
```prisma
model Invitation {
  id             String           @id @default(cuid())
  organizationId String
  email          String
  roleId         String
  status         InvitationStatus @default(pending)
  token          String           @unique
  expiresAt      DateTime
  createdAt      DateTime         @default(now())

  organization Organization @relation(fields: [organizationId], references: [id])
  role         Role         @relation(fields: [roleId], references: [id])

  @@index([organizationId])
  @@index([email])
}
```
> Invites belong to an org → carries `organizationId` (NOT allowlisted). Flagged for
> qa AC6 confirmation.

---

## Product / Inventory (5-layer) — **fully specified**

### Product
```prisma
model Product {
  id             String        @id @default(cuid())
  organizationId String
  code           String        // "A01"
  name           String
  status         ProductStatus @default(active)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  organization Organization  @relation(fields: [organizationId], references: [id])
  sellableSkus SellableSku[]

  @@unique([organizationId, code])
  @@index([organizationId])
}
```

### SellableSku — holds **no stock** (available computed in core-domain)
```prisma
model SellableSku {
  id             String   @id @default(cuid())
  organizationId String
  productId      String
  code           String   // "A01-เสื้อ+กระโปรง"
  name           String
  barcode        String?
  basePrice      Decimal  @db.Decimal(18, 4)   // money
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization    Organization      @relation(fields: [organizationId], references: [id])
  product         Product           @relation(fields: [productId], references: [id])
  bundleComponents BundleComponent[]
  channelListings  ChannelListing[]

  @@unique([organizationId, code])
  @@index([organizationId])
  @@index([productId])
}
```
> No `available` column — `available = min(floor(item.available / qty))` is
> core-domain (F-010+), never stored (schema-vs-logic rule).

### InventoryItem — holds stock (via StockLevel) + weighted-average cost
```prisma
model InventoryItem {
  id                String   @id @default(cuid())
  organizationId    String
  sku               String   // "เสื้อ-A01"
  name              String
  avgUnitCost       Decimal  @db.Decimal(18, 4)   // money — weighted-average (updated by F-011 write path)
  trackStock        Boolean  @default(true)
  lowStockThreshold Int?                            // qty
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  organization     Organization      @relation(fields: [organizationId], references: [id])
  stockLevels      StockLevel[]
  bundleComponents BundleComponent[]
  stockMovements   StockMovement[]

  @@unique([organizationId, sku])
  @@index([organizationId])
}
```
> `avgUnitCost` is a **stored** running weighted-average maintained transactionally on
> PURCHASE_IN (F-011) — it is state, not a per-read derived value, so it is a legit
> column. The *formula* stays in core-domain.

### BundleComponent — M:N SellableSku ↔ InventoryItem (composition line)
```prisma
model BundleComponent {
  id              String @id @default(cuid())
  organizationId  String
  sellableSkuId   String
  inventoryItemId String
  quantity        Int                              // qty per sellable unit
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization  Organization  @relation(fields: [organizationId], references: [id])
  sellableSku   SellableSku   @relation(fields: [sellableSkuId], references: [id])
  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])

  @@unique([sellableSkuId, inventoryItemId])   // AC5-required constraint
  @@index([organizationId])
  @@index([inventoryItemId])                    // component reused across sellables (docs/01 §5)
}
```

### Warehouse
```prisma
model Warehouse {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  isDefault      Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization   Organization    @relation(fields: [organizationId], references: [id])
  stockLevels    StockLevel[]
  stockMovements StockMovement[]

  @@index([organizationId])
}
```

### StockLevel — projection of the ledger (onHand/reserved stored; available derived)
```prisma
model StockLevel {
  id              String @id @default(cuid())
  organizationId  String
  warehouseId     String
  inventoryItemId String
  onHand          Int    @default(0)   // stock
  reserved        Int    @default(0)   // stock
  updatedAt       DateTime @updatedAt

  organization  Organization  @relation(fields: [organizationId], references: [id])
  warehouse     Warehouse     @relation(fields: [warehouseId], references: [id])
  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])

  @@unique([warehouseId, inventoryItemId])   // AC5-required constraint
  @@index([organizationId])
  @@index([inventoryItemId])
}
```
> `available = onHand − reserved` is core-domain, **not** a column. `onHand`/`reserved`
> are stored projection state maintained by the ledger write path (F-011).

---

## Stock ledger (immutable) — **fully specified** · trigger from architecture §2

### StockMovement — append-only; UPDATE/DELETE rejected by DB trigger (AC8)
```prisma
model StockMovement {
  id              String            @id @default(cuid())
  organizationId  String
  inventoryItemId String
  warehouseId     String
  type            StockMovementType
  quantity        Int                                // stock (+/-)
  unitCost        Decimal?          @db.Decimal(18, 4)  // money (nullable — e.g. ADJUST w/o cost)
  refType         String?                             // open-ended: ORDER | PURCHASE | ADJUSTMENT | ...
  refId           String?
  balanceAfter    Int                                 // stored audit snapshot (NOT derived — spec §2.1 exception)
  createdAt       DateTime          @default(now())
  createdBy       String?                             // FK to User deferred (auth wiring F-001); string for now

  organization  Organization  @relation(fields: [organizationId], references: [id])
  inventoryItem InventoryItem @relation(fields: [inventoryItemId], references: [id])
  warehouse     Warehouse     @relation(fields: [warehouseId], references: [id])

  @@index([organizationId])
  @@index([inventoryItemId])
  @@index([warehouseId])
  @@index([refType, refId])           // audit lookup by source doc
  // NO updatedAt — immutable. DB trigger (architecture §2) rejects UPDATE/DELETE.
}
```

---

## Channel (marketplace)

### Channel — **fully specified** · allowlist: NO `organizationId` (system master)
```prisma
model Channel {
  id          String     @id @default(cuid())
  key         ChannelKey @unique      // shopee | lazada | tiktok
  displayName String

  channelAccounts ChannelAccount[]
}
```
> System-level master, not per-org (docs/01 §2) → AC6 allowlist.

### ChannelAccount — **stub-structure** (authData encrypted; real auth in F-004/F-005)
```prisma
model ChannelAccount {
  id             String               @id @default(cuid())
  organizationId String
  channelKey     ChannelKey
  shopName       String
  externalShopId String
  authData       String?              // STUB — encrypted token blob (encryption impl F-004+). Nullable in F-000.
  status         ChannelAccountStatus @default(active)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  organization    Organization     @relation(fields: [organizationId], references: [id])
  channel         Channel          @relation(fields: [channelKey], references: [key])
  channelListings ChannelListing[]

  @@unique([organizationId, channelKey, externalShopId])   // one account per shop per org
  @@index([organizationId])
}
```

### ChannelListing — **fully specified** (structure); sync fields are stub state
```prisma
model ChannelListing {
  id               String               @id @default(cuid())
  organizationId   String
  channelAccountId String
  sellableSkuId    String
  externalItemId   String
  externalSkuId    String
  externalStatus   ChannelListingStatus @default(active)
  allocationMode   AllocationMode       @default(FULL)
  allocationValue  Int?                  // qty (buffer/fixed amount) — mode-dependent
  priceOverride    Decimal?             @db.Decimal(18, 4)  // money — empty = use basePrice
  lastSyncedStock  Int?                  // stock — sync state (written by F-004+)
  lastSyncedPrice  Decimal?             @db.Decimal(18, 4)  // money — sync state
  lastSyncedAt     DateTime?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  organization   Organization   @relation(fields: [organizationId], references: [id])
  channelAccount ChannelAccount @relation(fields: [channelAccountId], references: [id])
  sellableSku    SellableSku    @relation(fields: [sellableSkuId], references: [id])

  @@unique([channelAccountId, externalSkuId])   // AC5-required constraint (idempotent sync mapping)
  @@index([organizationId])
  @@index([sellableSkuId])
}
```

---

## Entitlements & Usage (scale-seam) — **stub-structure** (real logic F-007/Phase 5)

### PlanDefinition — allowlist: NO `organizationId` (system catalog)
```prisma
model PlanDefinition {
  id        String   @id @default(cuid())
  key       String   @unique              // comp_full | full | sync | free
  name      String
  version   Int      @default(1)
  tierLabel String?
  features  Json                          // open-ended map (boolean / static cap / metered)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orgEntitlements OrgEntitlement[]
}
```
> System-level plan catalog, not per-org → AC6 allowlist. `features` is `Json` (open
> map) so new features = new key, no migration (docs/01 §2).

### OrgEntitlement — one active per org
```prisma
model OrgEntitlement {
  id               String   @id @default(cuid())
  organizationId   String
  planDefinitionId String
  grants           Json?                   // itemized add-on/comp/grandfather grants
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization   Organization   @relation(fields: [organizationId], references: [id])
  planDefinition PlanDefinition @relation(fields: [planDefinitionId], references: [id])

  @@unique([organizationId])   // 1 org = 1 active entitlement (docs/01 §2)
  @@index([planDefinitionId])
}
```
> Resolved entitlement (`plan.features` folded with `grants`) is computed in the
> entitlements service (F-007) — **not** a column.

### UsageEvent — immutable append (golden rule 2); UPDATE/DELETE rejected by trigger (AC8)
```prisma
model UsageEvent {
  id             String   @id @default(cuid())
  organizationId String
  meter          String                          // orders | sync | ai.text | ai.image | ... (open-ended)
  quantity       Int                             // stock/count
  cost           Decimal? @db.Decimal(18, 4)     // money — Decimal, never float
  refType        String?
  refId          String?
  occurredAt     DateTime @default(now())
  createdBy      String?                         // FK to User deferred (F-001)

  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([meter])
  @@index([occurredAt])
  // NO updatedAt — immutable. DB trigger (architecture §2) rejects UPDATE/DELETE (AC8).
}
```

---

## Deliberately OUT (boundary auditable — spec §2.3)
`Order` / `OrderItem` → F-024 · `PurchaseDocument` / `PurchaseItem` /
`AccountingDocument` → Phase 2 · `Subscription` / `Payment` → Phase 5 (F-080).
These are **not** in F-000; their absence is intentional so a reviewer can audit the
boundary. (`StockMovement.createdBy` / `UsageEvent.createdBy` are `String?` not FK
because the auth-user wiring lands in F-001 — noted so it isn't mistaken for an
omission.)

## Stub vs fully-specified — quick map
| Model | F-000 status | Why |
|-------|--------------|-----|
| User, Membership, Role, RefreshToken, Invitation | fully specified | auth tables IN (D-004) — no floating FK |
| Organization | core fully specified; `taxProfile*` stub (nullable flat) | validated at Full tier (F-007) |
| Product, SellableSku, InventoryItem, BundleComponent, Warehouse, StockLevel | fully specified | core 5-layer, AC5 constraints live |
| StockMovement | fully specified + immutability trigger | ledger, AC8 |
| Channel, ChannelListing | fully specified (structure) | AC5 unique lives |
| ChannelAccount | stub-structure (`authData` nullable) | encryption/auth impl F-004+ |
| PlanDefinition, OrgEntitlement, UsageEvent | stub-structure | real logic F-007/Phase 5; UsageEvent trigger live (AC8) |

## Money columns (AC7 = `numeric`)
`SellableSku.basePrice` · `InventoryItem.avgUnitCost` · `StockMovement.unitCost` ·
`ChannelListing.priceOverride` · `ChannelListing.lastSyncedPrice` · `UsageEvent.cost`

## Stock/qty columns (AC7 = `integer`)
`StockLevel.onHand` · `StockLevel.reserved` · `BundleComponent.quantity` ·
`StockMovement.quantity` · `StockMovement.balanceAfter` · `UsageEvent.quantity`
(+ `InventoryItem.lowStockThreshold`, `ChannelListing.allocationValue`,
`ChannelListing.lastSyncedStock` — all `Int`)

## `organizationId` audit (AC6)
- **HAS org (domain tables):** Organization*, Membership, **Role**, **Invitation**,
  Product, SellableSku, InventoryItem, BundleComponent, Warehouse, StockLevel,
  StockMovement, ChannelAccount, ChannelListing, OrgEntitlement, UsageEvent.
  (*Organization is the tenant root — it has `id`, which is the org identity itself.)
- **NO org (allowlist, intentional):** **User, Channel, PlanDefinition, RefreshToken.**
- Any table outside the allowlist that lacks `organizationId` = AC6 fail. `Role` and
  `Invitation` are placed **with** org → flagged for qa AC6 confirmation.
