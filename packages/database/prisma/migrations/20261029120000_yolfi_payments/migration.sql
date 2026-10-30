CREATE TABLE "yolfi_payment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "invoiceId" TEXT,
    "subscriptionId" TEXT,
    "paylinkId" TEXT,
    "clientReferenceId" TEXT,
    "customerEmail" TEXT,
    "customerId" TEXT,
    "paymentType" TEXT,
    "status" TEXT NOT NULL,
    "amount" TEXT,
    "currency" TEXT,
    "payload" JSONB NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yolfi_payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "yolfi_payment_eventId_key" ON "yolfi_payment"("eventId");
CREATE INDEX "yolfi_payment_invoiceId_idx" ON "yolfi_payment"("invoiceId");
CREATE INDEX "yolfi_payment_subscriptionId_idx" ON "yolfi_payment"("subscriptionId");
CREATE INDEX "yolfi_payment_clientReferenceId_idx" ON "yolfi_payment"("clientReferenceId");
CREATE INDEX "yolfi_payment_customerEmail_idx" ON "yolfi_payment"("customerEmail");
CREATE INDEX "yolfi_payment_claimedById_idx" ON "yolfi_payment"("claimedById");

ALTER TABLE "yolfi_payment" ADD CONSTRAINT "yolfi_payment_claimedById_fkey"
FOREIGN KEY ("claimedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "yolfi_subscription" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yolfi_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "yolfi_subscription_subscriptionId_key" ON "yolfi_subscription"("subscriptionId");
