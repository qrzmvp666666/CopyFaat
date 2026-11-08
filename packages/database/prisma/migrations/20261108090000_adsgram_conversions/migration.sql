BEGIN;

ALTER TABLE "checkout_attribution" ADD COLUMN "adRecord" TEXT;
ALTER TABLE "purchase" ADD COLUMN "adRecord" TEXT, ADD COLUMN "firstPaidPaymentId" TEXT;
ALTER TABLE "ad_conversion"
  ALTER COLUMN "amountUsd" DROP NOT NULL,
  ADD COLUMN "amountMinor" INTEGER,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "adPlatform" TEXT,
  ADD COLUMN "adClickId" TEXT,
  ADD COLUMN "adRecord" TEXT,
  ADD COLUMN "subscriptionId" TEXT,
  ADD COLUMN "goal" TEXT NOT NULL DEFAULT 'first_purchase';

-- Preserve delivery history and prevent existing paid subscriptions converting on renewal.
UPDATE "ad_conversion" AS c SET
  "subscriptionId" = p."subscriptionId", "adPlatform" = p."adPlatform",
  "adClickId" = p."adClickId", "currency" = 'usd',
  "amountMinor" = ROUND(c."amountUsd"::numeric * 100)::integer
FROM "purchase" AS p
WHERE c."provider" = p."provider" AND c."attributionId" = p."attributionId";
UPDATE "purchase" AS p SET "firstPaidPaymentId" = c."paymentId"
FROM "ad_conversion" AS c
WHERE c."provider" = p."provider" AND c."subscriptionId" = p."subscriptionId";
-- Historical payments without a conversion have no reliable local first-payment history.
-- Keep trialing purchases eligible; suppress acquisition on legacy non-trial subscriptions.
UPDATE "purchase" SET "firstPaidPaymentId" = 'legacy_before_adsgram'
WHERE "type" = 'SUBSCRIPTION' AND "firstPaidPaymentId" IS NULL
  AND "status" IS DISTINCT FROM 'trialing';

CREATE UNIQUE INDEX "ad_conversion_provider_subscriptionId_goal_key"
  ON "ad_conversion"("provider", "subscriptionId", "goal");
CREATE UNIQUE INDEX "ad_conversion_adPlatform_adRecord_goal_key"
  ON "ad_conversion"("adPlatform", "adRecord", "goal");

COMMIT;
