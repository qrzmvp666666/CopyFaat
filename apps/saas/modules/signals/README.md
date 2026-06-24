# Signals Webhook

The signals page keeps its existing demo data and overlays webhook-received database signals on top of it. The page loads stored signals from `GET /api/signals`, then receives new webhook signals in real time over `GET /api/signals/events` using Server-Sent Events.

Signals are persisted through Prisma in the Postgres `signal` table. The current SSE endpoint is only the local "new signal arrived" notification channel for this Next.js process. For Supabase/serverless/multi-instance deployment, keep Prisma/Postgres as the source of truth and replace or complement local SSE with a shared event source, such as Supabase Realtime/Broadcast. Do not rely on process memory for production broadcasts across instances.

Set `SIGNAL_WEBHOOK_SECRET` to require callers to send `x-signal-webhook-secret`.

## Endpoint

`POST /api/signals/webhook`

## Request Body

```json
{
	"eventId": "external-btc-001",
	"symbol": "BTCUSDT",
	"direction": "long",
	"entry": 69680,
	"takeProfit": 72400,
	"stopLoss": 68400,
	"entryStatus": "entered",
	"status": "active",
	"submittedAt": "2026-06-21T14:20:00+08:00",
	"timeframe": "1h",
	"exchange": "binance",
	"chartPositionPct": 94,
	"source": {
		"id": "external-bot",
		"name": "外部信号",
		"avatarUrl": "https://i.pravatar.cc/80?img=12"
	},
	"note": "Optional operator note"
}
```

`eventId` is optional, but external producers should send it for source-level idempotency. Reusing the same `eventId` updates the existing database signal instead of creating a duplicate. When `eventId` is absent or changes between captures, SignalFast still deduplicates by trader, symbol, direction, entry, take-profit, and stop-loss. `submittedAt` is stored for display and recency, but it is not part of the business identity, so repeated captures of the same trading plan update one signal instead of creating multiple cards.

## Success Response

```json
{
	"ok": true,
	"receivedAt": "2026-06-21T06:20:03.000Z",
	"signal": {
		"id": "generated-local-id",
		"eventId": "external-btc-001",
		"symbol": "BTCUSDT",
		"direction": "long",
		"entry": 69680,
		"takeProfit": 72400,
		"stopLoss": 68400,
		"riskReward": 2.13,
		"entryStatus": "entered",
		"status": "active",
		"submittedAt": "2026-06-21T14:20:00+08:00",
		"chartPositionPct": 94,
		"source": {
			"id": "external-bot",
			"name": "外部信号",
			"avatarUrl": "https://i.pravatar.cc/80?img=12"
		}
	}
}
```

## Local Test

```bash
curl -sS -X POST http://signalfast.localhost:4100/api/signals/webhook \
	-H "Content-Type: application/json" \
	-H "x-signal-webhook-secret: $SIGNAL_WEBHOOK_SECRET" \
	-d '{
		"eventId": "local-btc-test-001",
		"symbol": "BTCUSDT",
		"direction": "long",
		"entry": 69680,
		"takeProfit": 72400,
		"stopLoss": 68400,
		"entryStatus": "entered",
		"status": "active",
		"submittedAt": "2026-06-21T14:20:00+08:00",
		"chartPositionPct": 94,
		"source": {
			"id": "local-webhook",
			"name": "本地Webhook",
			"avatarUrl": "https://i.pravatar.cc/80?img=12"
		}
	}'
```

Read stored signals:

```bash
curl -sS http://signalfast.localhost:4100/api/signals
```

Listen for live signal events:

```bash
curl -N http://signalfast.localhost:4100/api/signals/events
```

## AutoFastExt Local Bridge

For local integration testing, AutoFastExt can collect visible signal text from `https://kol.lysq.cc/signals`, normalize it into this webhook contract, and post it to SignalFast.

From `/Users/qrz/Desktop/AutoFastExt`:

```bash
node scripts/push-kol-signals-to-signalfast.js < /tmp/kol-signals-page-text.txt
```

The bridge posts to `http://signalfast.localhost:4100/api/signals/webhook` by default. Override it with `SIGNALFAST_WEBHOOK_URL` if the app runs somewhere else. If `SIGNAL_WEBHOOK_SECRET` is set for SignalFast, set the same value in AutoFastExt so the script sends `x-signal-webhook-secret`.

The bridge currently sends only complete signals that include valid entry, take-profit, and stop-loss prices. Incomplete rows are parsed as candidates but skipped because the webhook schema requires all three prices to calculate risk/reward and render the card/chart marker safely.
