-- Add a stable business identity for deduplicating repeated signal captures.
ALTER TABLE "signal" ADD COLUMN "businessKey" TEXT;

WITH ranked_signals AS (
    SELECT
        "signal"."id",
        "trader"."externalId"
            || '|'
            || "trading_symbol"."symbol"
            || '|'
            || "signal"."direction"
            || '|'
            || trim(TRAILING '.' FROM trim(TRAILING '0' FROM to_char("signal"."entry", 'FM999999999999990.99999999')))
            || '|'
            || trim(TRAILING '.' FROM trim(TRAILING '0' FROM to_char("signal"."takeProfit", 'FM999999999999990.99999999')))
            || '|'
            || trim(TRAILING '.' FROM trim(TRAILING '0' FROM to_char("signal"."stopLoss", 'FM999999999999990.99999999'))) AS "businessKey",
        row_number() OVER (
            PARTITION BY
                "trader"."externalId",
                "trading_symbol"."symbol",
                "signal"."direction",
                "signal"."entry",
                "signal"."takeProfit",
                "signal"."stopLoss"
            ORDER BY "signal"."submittedAt" DESC, "signal"."updatedAt" DESC, "signal"."id" DESC
        ) AS "rank"
    FROM "signal"
    INNER JOIN "trader" ON "trader"."id" = "signal"."traderId"
    INNER JOIN "trading_symbol" ON "trading_symbol"."id" = "signal"."symbolId"
)
UPDATE "signal"
SET "businessKey" = ranked_signals."businessKey"
FROM ranked_signals
WHERE "signal"."id" = ranked_signals."id"
    AND ranked_signals."rank" = 1;

CREATE UNIQUE INDEX "signal_businessKey_key" ON "signal"("businessKey");
