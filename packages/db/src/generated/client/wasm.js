
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  verified: 'verified',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrganizationScalarFieldEnum = {
  id: 'id',
  name: 'name',
  logo: 'logo',
  timezone: 'timezone',
  currency: 'currency',
  taxEntityType: 'taxEntityType',
  taxId: 'taxId',
  vatRegistered: 'vatRegistered',
  taxBranchCode: 'taxBranchCode',
  createdByUserId: 'createdByUserId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MembershipScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  userId: 'userId',
  roleId: 'roleId',
  status: 'status',
  activatedAt: 'activatedAt',
  revokedAt: 'revokedAt',
  revokedByUserId: 'revokedByUserId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  isSystem: 'isSystem',
  capabilities: 'capabilities',
  key: 'key',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  familyId: 'familyId',
  tokenHash: 'tokenHash',
  deviceId: 'deviceId',
  rotatedFrom: 'rotatedFrom',
  expiresAt: 'expiresAt',
  familyExpiresAt: 'familyExpiresAt',
  lastUsedAt: 'lastUsedAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt'
};

exports.Prisma.InvitationScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  email: 'email',
  roleId: 'roleId',
  status: 'status',
  tokenHash: 'tokenHash',
  tokenIssuedAt: 'tokenIssuedAt',
  expiresAt: 'expiresAt',
  invitedByUserId: 'invitedByUserId',
  acceptedAt: 'acceptedAt',
  acceptedByUserId: 'acceptedByUserId',
  acceptedUserCreatedAt: 'acceptedUserCreatedAt',
  cancelledAt: 'cancelledAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  code: 'code',
  name: 'name',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SellableSkuScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  productId: 'productId',
  code: 'code',
  name: 'name',
  barcode: 'barcode',
  basePrice: 'basePrice',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InventoryItemScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  sku: 'sku',
  name: 'name',
  avgUnitCost: 'avgUnitCost',
  trackStock: 'trackStock',
  lowStockThreshold: 'lowStockThreshold',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BundleComponentScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  sellableSkuId: 'sellableSkuId',
  inventoryItemId: 'inventoryItemId',
  quantity: 'quantity',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WarehouseScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  name: 'name',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockLevelScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  warehouseId: 'warehouseId',
  inventoryItemId: 'inventoryItemId',
  onHand: 'onHand',
  reserved: 'reserved',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockMovementScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  inventoryItemId: 'inventoryItemId',
  warehouseId: 'warehouseId',
  type: 'type',
  quantity: 'quantity',
  unitCost: 'unitCost',
  refType: 'refType',
  refId: 'refId',
  balanceAfter: 'balanceAfter',
  createdAt: 'createdAt',
  createdBy: 'createdBy'
};

exports.Prisma.ChannelScalarFieldEnum = {
  id: 'id',
  key: 'key',
  displayName: 'displayName'
};

exports.Prisma.ChannelAccountScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  channelKey: 'channelKey',
  shopName: 'shopName',
  externalShopId: 'externalShopId',
  authData: 'authData',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ChannelListingScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  channelAccountId: 'channelAccountId',
  sellableSkuId: 'sellableSkuId',
  externalItemId: 'externalItemId',
  externalSkuId: 'externalSkuId',
  externalStatus: 'externalStatus',
  allocationMode: 'allocationMode',
  allocationValue: 'allocationValue',
  priceOverride: 'priceOverride',
  lastSyncedStock: 'lastSyncedStock',
  lastSyncedPrice: 'lastSyncedPrice',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlanDefinitionScalarFieldEnum = {
  id: 'id',
  key: 'key',
  name: 'name',
  version: 'version',
  tierLabel: 'tierLabel',
  features: 'features',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrgEntitlementScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  planDefinitionId: 'planDefinitionId',
  grants: 'grants',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UsageEventScalarFieldEnum = {
  id: 'id',
  organizationId: 'organizationId',
  meter: 'meter',
  quantity: 'quantity',
  cost: 'cost',
  refType: 'refType',
  refId: 'refId',
  occurredAt: 'occurredAt',
  createdBy: 'createdBy'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.MembershipStatus = exports.$Enums.MembershipStatus = {
  active: 'active',
  invited: 'invited',
  revoked: 'revoked'
};

exports.InvitationStatus = exports.$Enums.InvitationStatus = {
  pending: 'pending',
  accepted: 'accepted',
  expired: 'expired',
  cancelled: 'cancelled'
};

exports.ProductStatus = exports.$Enums.ProductStatus = {
  active: 'active',
  archived: 'archived'
};

exports.StockMovementType = exports.$Enums.StockMovementType = {
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  ADJUST: 'ADJUST',
  TRANSFER: 'TRANSFER',
  RETURN: 'RETURN',
  ASSEMBLY: 'ASSEMBLY'
};

exports.ChannelKey = exports.$Enums.ChannelKey = {
  shopee: 'shopee',
  lazada: 'lazada',
  tiktok: 'tiktok'
};

exports.ChannelAccountStatus = exports.$Enums.ChannelAccountStatus = {
  active: 'active',
  expired: 'expired',
  revoked: 'revoked'
};

exports.ChannelListingStatus = exports.$Enums.ChannelListingStatus = {
  active: 'active',
  inactive: 'inactive',
  error: 'error'
};

exports.AllocationMode = exports.$Enums.AllocationMode = {
  FULL: 'FULL',
  BUFFER: 'BUFFER',
  FIXED: 'FIXED',
  DYNAMIC: 'DYNAMIC'
};

exports.Prisma.ModelName = {
  User: 'User',
  Organization: 'Organization',
  Membership: 'Membership',
  Role: 'Role',
  RefreshToken: 'RefreshToken',
  Invitation: 'Invitation',
  Product: 'Product',
  SellableSku: 'SellableSku',
  InventoryItem: 'InventoryItem',
  BundleComponent: 'BundleComponent',
  Warehouse: 'Warehouse',
  StockLevel: 'StockLevel',
  StockMovement: 'StockMovement',
  Channel: 'Channel',
  ChannelAccount: 'ChannelAccount',
  ChannelListing: 'ChannelListing',
  PlanDefinition: 'PlanDefinition',
  OrgEntitlement: 'OrgEntitlement',
  UsageEvent: 'UsageEvent'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
