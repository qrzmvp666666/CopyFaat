-- CreateTable
CREATE TABLE "redeem_code_batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "redeemBefore" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redeem_code_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redeem_code" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redeem_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemCodeId" TEXT,
    "source" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlement_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "redeem_code_batch_createdById_idx" ON "redeem_code_batch"("createdById");

-- CreateIndex
CREATE INDEX "redeem_code_batch_redeemBefore_idx" ON "redeem_code_batch"("redeemBefore");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_code_code_key" ON "redeem_code"("code");

-- CreateIndex
CREATE UNIQUE INDEX "redeem_code_codeHash_key" ON "redeem_code"("codeHash");

-- CreateIndex
CREATE INDEX "redeem_code_batchId_idx" ON "redeem_code"("batchId");

-- CreateIndex
CREATE INDEX "redeem_code_status_idx" ON "redeem_code"("status");

-- CreateIndex
CREATE INDEX "redeem_code_redeemedById_idx" ON "redeem_code"("redeemedById");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grant_redeemCodeId_key" ON "entitlement_grant"("redeemCodeId");

-- CreateIndex
CREATE INDEX "entitlement_grant_userId_idx" ON "entitlement_grant"("userId");

-- CreateIndex
CREATE INDEX "entitlement_grant_startsAt_idx" ON "entitlement_grant"("startsAt");

-- CreateIndex
CREATE INDEX "entitlement_grant_expiresAt_idx" ON "entitlement_grant"("expiresAt");

-- AddForeignKey
ALTER TABLE "redeem_code_batch" ADD CONSTRAINT "redeem_code_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_code" ADD CONSTRAINT "redeem_code_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "redeem_code_batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redeem_code" ADD CONSTRAINT "redeem_code_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_redeemCodeId_fkey" FOREIGN KEY ("redeemCodeId") REFERENCES "redeem_code"("id") ON DELETE SET NULL ON UPDATE CASCADE;
