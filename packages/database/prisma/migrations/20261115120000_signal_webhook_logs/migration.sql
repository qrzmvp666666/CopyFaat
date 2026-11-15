CREATE TABLE "signal_webhook_log" (
 "id" TEXT NOT NULL,
 "mode" TEXT NOT NULL DEFAULT 'single',
 "status" TEXT NOT NULL DEFAULT 'processing',
 "httpStatus" INTEGER,
 "total" INTEGER NOT NULL DEFAULT 0,
 "saved" INTEGER NOT NULL DEFAULT 0,
 "ignored" INTEGER NOT NULL DEFAULT 0,
 "invalid" INTEGER NOT NULL DEFAULT 0,
 "failed" INTEGER NOT NULL DEFAULT 0,
 "durationMs" INTEGER,
 "error" TEXT,
 "searchText" TEXT NOT NULL DEFAULT '',
 "items" JSONB NOT NULL DEFAULT '[]',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "completedAt" TIMESTAMP(3),
 CONSTRAINT "signal_webhook_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "signal_webhook_log_createdAt_id_idx" ON "signal_webhook_log"("createdAt", "id");
CREATE INDEX "signal_webhook_log_status_createdAt_idx" ON "signal_webhook_log"("status", "createdAt");
-- Only the backend database owner can access audit records; no browser API policies.
ALTER TABLE "signal_webhook_log" ENABLE ROW LEVEL SECURITY;
