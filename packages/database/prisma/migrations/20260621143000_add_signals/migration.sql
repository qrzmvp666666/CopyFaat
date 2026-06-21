-- CreateTable
CREATE TABLE "signal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'active',
    "entry" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "riskReward" DOUBLE PRECISION NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "chartPositionPct" DOUBLE PRECISION NOT NULL DEFAULT 92,
    "sourceId" TEXT,
    "sourceName" TEXT NOT NULL,
    "sourceAvatarUrl" TEXT,
    "exchange" TEXT,
    "timeframe" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signal_eventId_key" ON "signal"("eventId");

-- CreateIndex
CREATE INDEX "signal_symbol_status_idx" ON "signal"("symbol", "status");

-- CreateIndex
CREATE INDEX "signal_sourceId_idx" ON "signal"("sourceId");

-- CreateIndex
CREATE INDEX "signal_submittedAt_idx" ON "signal"("submittedAt");
