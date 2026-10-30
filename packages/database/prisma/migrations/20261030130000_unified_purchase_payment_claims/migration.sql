ALTER TABLE "purchase"
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe',
ADD COLUMN "claimStatus" TEXT NOT NULL DEFAULT 'claimed',
ADD COLUMN "customerEmail" TEXT,
ADD COLUMN "paymentLinkId" TEXT,
ADD COLUMN "visitorId" TEXT,
ADD COLUMN "datafastVisitorId" TEXT,
ADD COLUMN "datafastSessionId" TEXT;

INSERT INTO "purchase" (
    "id",
    "userId",
    "type",
    "provider",
    "claimStatus",
    "customerId",
    "customerEmail",
    "subscriptionId",
    "paymentLinkId",
    "visitorId",
    "priceId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'yolfi_migrated_' || md5(payment."subscriptionId"),
    payment."claimedById",
    'SUBSCRIPTION'::"PurchaseType",
    'yolfi',
    CASE WHEN payment."claimedById" IS NULL THEN 'pending' ELSE 'claimed' END,
    COALESCE(payment."customerId", 'yolfi_' || payment."subscriptionId"),
    LOWER(payment."customerEmail"),
    payment."subscriptionId",
    payment."paylinkId",
    payment."clientReferenceId",
    CASE
        WHEN payment."paylinkId" = '340ba658-394f-439c-9abc-36985d2383d3' THEN 'yolfi_pro_weekly'
        WHEN payment."paylinkId" = '75797130-8b5c-4814-8266-204472a4be16' THEN 'yolfi_pro_yearly'
        ELSE 'yolfi_unmapped'
    END,
    COALESCE(
        subscription."status",
        CASE WHEN payment."status" = 'confirmed' THEN 'active' ELSE 'incomplete' END
    ),
    payment."createdAt",
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON ("subscriptionId") *
    FROM "yolfi_payment"
    WHERE "subscriptionId" IS NOT NULL
      AND "paymentType" = 'RECURRING'
    ORDER BY "subscriptionId", ("status" = 'confirmed') DESC, ("customerEmail" IS NOT NULL) DESC, "createdAt" DESC
) AS payment
LEFT JOIN "yolfi_subscription" AS subscription
    ON subscription."subscriptionId" = payment."subscriptionId"
ON CONFLICT ("subscriptionId") DO UPDATE SET
    "provider" = 'yolfi',
    "userId" = COALESCE("purchase"."userId", EXCLUDED."userId"),
    "claimStatus" = CASE
        WHEN COALESCE("purchase"."userId", EXCLUDED."userId") IS NULL THEN 'pending'
        ELSE 'claimed'
    END,
    "customerEmail" = COALESCE("purchase"."customerEmail", EXCLUDED."customerEmail"),
    "paymentLinkId" = COALESCE("purchase"."paymentLinkId", EXCLUDED."paymentLinkId"),
    "visitorId" = COALESCE("purchase"."visitorId", EXCLUDED."visitorId"),
    "priceId" = EXCLUDED."priceId",
    "status" = EXCLUDED."status",
    "updatedAt" = CURRENT_TIMESTAMP;

DROP TABLE "yolfi_payment";
DROP TABLE "yolfi_subscription";

CREATE INDEX "purchase_customerEmail_claimStatus_idx"
ON "purchase"("customerEmail", "claimStatus");

CREATE INDEX "purchase_visitorId_idx" ON "purchase"("visitorId");
