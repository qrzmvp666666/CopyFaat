/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'username', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'displayUsername', 'twoFactorEnabled', 'lastActiveOrganizationId'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId', 'createdAt'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'provider', 'claimStatus', 'customerId', 'customerEmail', 'subscriptionId', 'paymentLinkId', 'visitorId', 'attributionId', 'adPlatform', 'adClickId', 'adRecord', 'firstPaidPaymentId', 'taliviaVisitorId', 'taliviaSessionId', 'priceId', 'status', 'createdAt', 'updatedAt'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: RedeemCodeBatchScalarFieldEnum.schema.ts

export const RedeemCodeBatchScalarFieldEnumSchema = z.enum(['id', 'name', 'planId', 'durationDays', 'quantity', 'redeemBefore', 'note', 'createdById', 'createdAt', 'updatedAt'])

export type RedeemCodeBatchScalarFieldEnum = z.infer<typeof RedeemCodeBatchScalarFieldEnumSchema>;

// File: RedeemCodeScalarFieldEnum.schema.ts

export const RedeemCodeScalarFieldEnumSchema = z.enum(['id', 'batchId', 'code', 'codeHash', 'codePrefix', 'status', 'redeemedById', 'redeemedAt', 'createdAt', 'updatedAt'])

export type RedeemCodeScalarFieldEnum = z.infer<typeof RedeemCodeScalarFieldEnumSchema>;

// File: EntitlementGrantScalarFieldEnum.schema.ts

export const EntitlementGrantScalarFieldEnumSchema = z.enum(['id', 'userId', 'redeemCodeId', 'source', 'planId', 'durationDays', 'startsAt', 'expiresAt', 'createdAt', 'updatedAt'])

export type EntitlementGrantScalarFieldEnum = z.infer<typeof EntitlementGrantScalarFieldEnumSchema>;

// File: NotificationScalarFieldEnum.schema.ts

export const NotificationScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'data', 'link', 'read', 'createdAt', 'updatedAt'])

export type NotificationScalarFieldEnum = z.infer<typeof NotificationScalarFieldEnumSchema>;

// File: UserNotificationPreferenceScalarFieldEnum.schema.ts

export const UserNotificationPreferenceScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'target', 'createdAt'])

export type UserNotificationPreferenceScalarFieldEnum = z.infer<typeof UserNotificationPreferenceScalarFieldEnumSchema>;

// File: TraderScalarFieldEnum.schema.ts

export const TraderScalarFieldEnumSchema = z.enum(['id', 'externalId', 'name', 'displayName', 'avatarUrl', 'platform', 'handle', 'bio', 'isActive', 'createdAt', 'updatedAt'])

export type TraderScalarFieldEnum = z.infer<typeof TraderScalarFieldEnumSchema>;

// File: TradingSymbolScalarFieldEnum.schema.ts

export const TradingSymbolScalarFieldEnumSchema = z.enum(['id', 'symbol', 'baseAsset', 'quoteAsset', 'exchange', 'displayName', 'logoUrl', 'pricePrecision', 'isActive', 'createdAt', 'updatedAt'])

export type TradingSymbolScalarFieldEnum = z.infer<typeof TradingSymbolScalarFieldEnumSchema>;

// File: SignalScalarFieldEnum.schema.ts

export const SignalScalarFieldEnumSchema = z.enum(['id', 'eventId', 'businessKey', 'traderId', 'symbolId', 'direction', 'entryStatus', 'status', 'entry', 'takeProfit', 'stopLoss', 'riskReward', 'submittedAt', 'chartPositionPct', 'exchange', 'timeframe', 'outcome', 'note', 'createdAt', 'updatedAt'])

export type SignalScalarFieldEnum = z.infer<typeof SignalScalarFieldEnumSchema>;

// File: CheckoutAttributionScalarFieldEnum.schema.ts

export const CheckoutAttributionScalarFieldEnumSchema = z.enum(['id', 'provider', 'paymentLinkUrl', 'adPlatform', 'adClickId', 'adRecord', 'taliviaVisitorId', 'taliviaSessionId', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'createdAt'])

export type CheckoutAttributionScalarFieldEnum = z.infer<typeof CheckoutAttributionScalarFieldEnumSchema>;

// File: AdConversionScalarFieldEnum.schema.ts

export const AdConversionScalarFieldEnumSchema = z.enum(['id', 'provider', 'paymentId', 'attributionId', 'amountUsd', 'amountMinor', 'currency', 'adPlatform', 'adClickId', 'adRecord', 'subscriptionId', 'goal', 'status', 'attempts', 'lastError', 'createdAt', 'updatedAt'])

export type AdConversionScalarFieldEnum = z.infer<typeof AdConversionScalarFieldEnumSchema>;

// File: SignalWebhookLogScalarFieldEnum.schema.ts

export const SignalWebhookLogScalarFieldEnumSchema = z.enum(['id', 'mode', 'status', 'httpStatus', 'total', 'saved', 'ignored', 'invalid', 'failed', 'durationMs', 'error', 'searchText', 'items', 'createdAt', 'completedAt'])

export type SignalWebhookLogScalarFieldEnum = z.infer<typeof SignalWebhookLogScalarFieldEnumSchema>;

// File: SignalSourceBindingScalarFieldEnum.schema.ts

export const SignalSourceBindingScalarFieldEnumSchema = z.enum(['id', 'platform', 'serverName', 'channelName', 'categoryName', 'platformKey', 'serverKey', 'channelKey', 'categoryKey', 'traderId', 'isActive', 'createdAt', 'updatedAt'])

export type SignalSourceBindingScalarFieldEnum = z.infer<typeof SignalSourceBindingScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: NotificationType.schema.ts

export const NotificationTypeSchema = z.enum(['WELCOME', 'APP_UPDATE'])

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// File: NotificationTarget.schema.ts

export const NotificationTargetSchema = z.enum(['IN_APP', 'EMAIL'])

export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  username: z.string().nullish(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  displayUsername: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
  lastActiveOrganizationId: z.string().nullish(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
  createdAt: z.date(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  provider: z.string().default("stripe"),
  claimStatus: z.string().default("claimed"),
  customerId: z.string(),
  customerEmail: z.string().nullish(),
  subscriptionId: z.string().nullish(),
  paymentLinkId: z.string().nullish(),
  visitorId: z.string().nullish(),
  attributionId: z.string().nullish(),
  adPlatform: z.string().nullish(),
  adClickId: z.string().nullish(),
  adRecord: z.string().nullish(),
  firstPaidPaymentId: z.string().nullish(),
  taliviaVisitorId: z.string().nullish(),
  taliviaSessionId: z.string().nullish(),
  priceId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: RedeemCodeBatch.schema.ts

export const RedeemCodeBatchSchema = z.object({
  id: z.string(),
  name: z.string(),
  planId: z.string(),
  durationDays: z.number().int(),
  quantity: z.number().int(),
  redeemBefore: z.date().nullish(),
  note: z.string().nullish(),
  createdById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RedeemCodeBatchType = z.infer<typeof RedeemCodeBatchSchema>;


// File: RedeemCode.schema.ts

export const RedeemCodeSchema = z.object({
  id: z.string(),
  batchId: z.string(),
  code: z.string(),
  codeHash: z.string(),
  codePrefix: z.string(),
  status: z.string().default("available"),
  redeemedById: z.string().nullish(),
  redeemedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RedeemCodeType = z.infer<typeof RedeemCodeSchema>;


// File: EntitlementGrant.schema.ts

export const EntitlementGrantSchema = z.object({
  id: z.string(),
  userId: z.string(),
  redeemCodeId: z.string().nullish(),
  source: z.string(),
  planId: z.string(),
  durationDays: z.number().int(),
  startsAt: z.date(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EntitlementGrantType = z.infer<typeof EntitlementGrantSchema>;


// File: Notification.schema.ts

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  data: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  link: z.string().nullish(),
  read: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type NotificationModel = z.infer<typeof NotificationSchema>;

// File: UserNotificationPreference.schema.ts

export const UserNotificationPreferenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  target: NotificationTargetSchema,
  createdAt: z.date(),
});

export type UserNotificationPreferenceType = z.infer<typeof UserNotificationPreferenceSchema>;


// File: Trader.schema.ts

export const TraderSchema = z.object({
  id: z.string(),
  externalId: z.string(),
  name: z.string(),
  displayName: z.string().nullish(),
  avatarUrl: z.string().nullish(),
  platform: z.string().nullish(),
  handle: z.string().nullish(),
  bio: z.string().nullish(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TraderType = z.infer<typeof TraderSchema>;


// File: TradingSymbol.schema.ts

export const TradingSymbolSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  exchange: z.string().default("binance"),
  displayName: z.string().nullish(),
  logoUrl: z.string().nullish(),
  pricePrecision: z.number().int().nullish(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TradingSymbolType = z.infer<typeof TradingSymbolSchema>;


// File: Signal.schema.ts

export const SignalSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  businessKey: z.string().nullish(),
  traderId: z.string(),
  symbolId: z.string(),
  direction: z.string(),
  entryStatus: z.string().default("pending"),
  status: z.string().default("active"),
  entry: z.number(),
  takeProfit: z.number().nullish(),
  stopLoss: z.number(),
  riskReward: z.number(),
  submittedAt: z.date(),
  chartPositionPct: z.number().default(92.0),
  exchange: z.string().nullish(),
  timeframe: z.string().nullish(),
  outcome: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SignalType = z.infer<typeof SignalSchema>;


// File: CheckoutAttribution.schema.ts

export const CheckoutAttributionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  paymentLinkUrl: z.string(),
  adPlatform: z.string().nullish(),
  adClickId: z.string().nullish(),
  adRecord: z.string().nullish(),
  taliviaVisitorId: z.string().nullish(),
  taliviaSessionId: z.string().nullish(),
  utmSource: z.string().nullish(),
  utmMedium: z.string().nullish(),
  utmCampaign: z.string().nullish(),
  utmContent: z.string().nullish(),
  utmTerm: z.string().nullish(),
  createdAt: z.date(),
});

export type CheckoutAttributionType = z.infer<typeof CheckoutAttributionSchema>;


// File: AdConversion.schema.ts

export const AdConversionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  paymentId: z.string(),
  attributionId: z.string(),
  amountUsd: z.string().nullish(),
  amountMinor: z.number().int().nullish(),
  currency: z.string().nullish(),
  adPlatform: z.string().nullish(),
  adClickId: z.string().nullish(),
  adRecord: z.string().nullish(),
  subscriptionId: z.string().nullish(),
  goal: z.string().default("first_purchase"),
  status: z.string().default("pending"),
  attempts: z.number().int(),
  lastError: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AdConversionType = z.infer<typeof AdConversionSchema>;


// File: SignalWebhookLog.schema.ts

export const SignalWebhookLogSchema = z.object({
  id: z.string(),
  mode: z.string().default("single"),
  status: z.string().default("processing"),
  httpStatus: z.number().int().nullish(),
  total: z.number().int(),
  saved: z.number().int(),
  ignored: z.number().int(),
  invalid: z.number().int(),
  failed: z.number().int(),
  durationMs: z.number().int().nullish(),
  error: z.string().nullish(),
  searchText: z.string(),
  items: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  createdAt: z.date(),
  completedAt: z.date().nullish(),
});

export type SignalWebhookLogType = z.infer<typeof SignalWebhookLogSchema>;


// File: SignalSourceBinding.schema.ts

export const SignalSourceBindingSchema = z.object({
  id: z.string(),
  platform: z.string(),
  serverName: z.string(),
  channelName: z.string(),
  categoryName: z.string(),
  platformKey: z.string(),
  serverKey: z.string(),
  channelKey: z.string(),
  categoryKey: z.string(),
  traderId: z.string(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SignalSourceBindingType = z.infer<typeof SignalSourceBindingSchema>;

