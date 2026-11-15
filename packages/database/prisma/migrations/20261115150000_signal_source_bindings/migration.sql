CREATE TABLE "signal_source_binding" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "platform" TEXT NOT NULL,
 "serverName" TEXT NOT NULL,
 "channelName" TEXT NOT NULL,
 "categoryName" TEXT NOT NULL DEFAULT '',
 "platformKey" TEXT NOT NULL,
 "serverKey" TEXT NOT NULL,
 "channelKey" TEXT NOT NULL,
 "categoryKey" TEXT NOT NULL DEFAULT '',
 "traderId" TEXT NOT NULL REFERENCES "trader"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "signal_source_binding_names_check" CHECK (length("platformKey") > 0 AND length("serverKey") > 0 AND length("channelKey") > 0)
);
CREATE UNIQUE INDEX "signal_source_binding_platformKey_serverKey_channelKey_categoryKey_key" ON "signal_source_binding"("platformKey", "serverKey", "channelKey", "categoryKey");
CREATE INDEX "signal_source_binding_traderId_idx" ON "signal_source_binding"("traderId");
ALTER TABLE "signal_source_binding" ENABLE ROW LEVEL SECURITY;
