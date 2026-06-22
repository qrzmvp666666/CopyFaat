-- CreateTable
CREATE TABLE "trading_symbol" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL DEFAULT 'binance',
    "displayName" TEXT,
    "logoUrl" TEXT,
    "pricePrecision" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_symbol_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "signal" ADD COLUMN "symbolId" TEXT;

-- Backfill symbol master records from existing signals.
INSERT INTO "trading_symbol" (
    "id",
    "symbol",
    "baseAsset",
    "quoteAsset",
    "exchange",
    "displayName",
    "createdAt",
    "updatedAt"
)
SELECT
    source."symbol",
    source."symbol",
    CASE
        WHEN source."symbol" ~ 'USDT$' THEN regexp_replace(source."symbol", 'USDT$', '')
        WHEN source."symbol" ~ 'USDC$' THEN regexp_replace(source."symbol", 'USDC$', '')
        WHEN source."symbol" ~ 'USD$' THEN regexp_replace(source."symbol", 'USD$', '')
        ELSE source."symbol"
    END AS "baseAsset",
    CASE
        WHEN source."symbol" ~ 'USDT$' THEN 'USDT'
        WHEN source."symbol" ~ 'USDC$' THEN 'USDC'
        WHEN source."symbol" ~ 'USD$' THEN 'USD'
        ELSE ''
    END AS "quoteAsset",
    'binance',
    CASE
        WHEN source."symbol" ~ 'USDT$' THEN regexp_replace(source."symbol", 'USDT$', '') || '/USDT'
        WHEN source."symbol" ~ 'USDC$' THEN regexp_replace(source."symbol", 'USDC$', '') || '/USDC'
        WHEN source."symbol" ~ 'USD$' THEN regexp_replace(source."symbol", 'USD$', '') || '/USD'
        ELSE source."symbol"
    END AS "displayName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "symbol"
    FROM "signal"
) source;

UPDATE "signal"
SET "symbolId" = "symbol";

ALTER TABLE "signal" ALTER COLUMN "symbolId" SET NOT NULL;

-- Drop old denormalized symbol field.
DROP INDEX IF EXISTS "signal_symbol_status_idx";

ALTER TABLE "signal"
    DROP COLUMN "symbol";

-- CreateIndex
CREATE UNIQUE INDEX "trading_symbol_symbol_key" ON "trading_symbol"("symbol");

-- CreateIndex
CREATE INDEX "trading_symbol_baseAsset_idx" ON "trading_symbol"("baseAsset");

-- CreateIndex
CREATE INDEX "trading_symbol_quoteAsset_idx" ON "trading_symbol"("quoteAsset");

-- CreateIndex
CREATE INDEX "signal_symbolId_status_idx" ON "signal"("symbolId", "status");

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "trading_symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
