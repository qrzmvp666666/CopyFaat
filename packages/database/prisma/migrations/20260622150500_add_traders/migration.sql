-- CreateTable
CREATE TABLE "trader" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "platform" TEXT,
    "handle" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "signal" ADD COLUMN "traderId" TEXT;

-- Backfill traders from existing signal source fields.
INSERT INTO "trader" (
    "id",
    "externalId",
    "name",
    "avatarUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    source."externalId",
    source."externalId",
    MAX(source."sourceName") AS "name",
    MAX(source."sourceAvatarUrl") AS "avatarUrl",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        COALESCE(NULLIF("sourceId", ''), "sourceName") AS "externalId",
        "sourceName",
        "sourceAvatarUrl"
    FROM "signal"
) source
GROUP BY source."externalId";

UPDATE "signal"
SET "traderId" = COALESCE(NULLIF("sourceId", ''), "sourceName");

ALTER TABLE "signal" ALTER COLUMN "traderId" SET NOT NULL;

-- Drop old denormalized source fields.
DROP INDEX IF EXISTS "signal_sourceId_idx";

ALTER TABLE "signal"
    DROP COLUMN "sourceId",
    DROP COLUMN "sourceName",
    DROP COLUMN "sourceAvatarUrl";

-- CreateIndex
CREATE UNIQUE INDEX "trader_externalId_key" ON "trader"("externalId");

-- CreateIndex
CREATE INDEX "trader_name_idx" ON "trader"("name");

-- CreateIndex
CREATE INDEX "signal_traderId_idx" ON "signal"("traderId");

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "trader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
