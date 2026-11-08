-- Checkout snapshots and advertiser delivery tasks are server-only records.
-- Prisma connects as the backend owner; browser Data API roles receive no policies.
ALTER TABLE "checkout_attribution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_conversion" ENABLE ROW LEVEL SECURITY;
