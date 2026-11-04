ALTER TABLE "purchase"
ADD COLUMN "attributionId" TEXT,
ADD COLUMN "adPlatform" TEXT,
ADD COLUMN "adClickId" TEXT,
ADD COLUMN "taliviaVisitorId" TEXT,
ADD COLUMN "taliviaSessionId" TEXT;

CREATE TABLE "checkout_attribution" (
 "id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "paymentLinkUrl" TEXT NOT NULL,
 "adPlatform" TEXT, "adClickId" TEXT, "taliviaVisitorId" TEXT, "taliviaSessionId" TEXT,
 "utmSource" TEXT, "utmMedium" TEXT, "utmCampaign" TEXT, "utmContent" TEXT, "utmTerm" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "checkout_attribution_provider_taliviaSessionId_createdAt_idx"
ON "checkout_attribution"("provider", "taliviaSessionId", "createdAt");

CREATE TABLE "ad_conversion" (
 "id" TEXT PRIMARY KEY, "provider" TEXT NOT NULL, "paymentId" TEXT NOT NULL,
 "attributionId" TEXT NOT NULL, "amountUsd" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
 "attempts" INTEGER NOT NULL DEFAULT 0, "lastError" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ad_conversion_provider_paymentId_key" ON "ad_conversion"("provider", "paymentId");
CREATE UNIQUE INDEX "ad_conversion_provider_attributionId_key" ON "ad_conversion"("provider", "attributionId");
