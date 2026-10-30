# Signals Webhook

`/signals` is public. Only an identified signed-in user with confirmed paid access skips onboarding and receives the full workspace. Anonymous visitors, unpaid users, and visitors whose identity or entitlement cannot be verified see the guide on every visit, regardless of previous completion. Finishing or closing it opens membership plans; dismissing those plans returns to the guide. Anonymous visitors can sign in directly from the guide or paywall.

The locked workspace renders the real layout behind a glass blur mask. It uses public exchange candles from `/api/market/klines` and allowlisted trader/symbol metadata plus up to three real signal summaries from `/api/signals/preview`. Trader choices come from active database trader profiles linked to real signals, so no sample identities are fabricated. The summaries omit entry, take-profit, stop-loss, event IDs, and private notes. Pro users load full stored signals from `GET /api/signals`, then receive webhook signals over `GET /api/signals/events`; these endpoints and `/api/signals/klines` independently verify paid access. Legacy signup trial grants do not qualify.

The guide uses transparent text and outlined actions beside the highlighted feature, choosing available space below, above, or alongside it without covering the target. It covers trader selection, filters, chart, and the full signal panel including both tabs and its list. Responsive targets highlight the visible trader controls and the mobile filter button or desktop filter inputs. The filter step names direction, time window, and entry status. The paywall shows only Pro weekly/yearly options, matching the marketing pricing section.

On mobile, the paywall offers fixed weekly and yearly Stripe Payment Links for card payment and Yolfi Paylinks for stablecoin payment. The Talivia `talivia_visitor_id` cookie is sent as Stripe `client_reference_id` or Yolfi `clientReferenceId` for attribution only; it never grants access or proves ownership. Both providers write subscription records to the shared `purchase` table. Purchases without an account remain pending claim and are linked only when the signed-in account has a verified email matching the payment email. Provider, payment link ID, email, Talivia visitor ID, Datafast visitor/session IDs, subscription status, and claim status are retained on that purchase record.

Configure Stripe Payment Links with recurring weekly/yearly prices. Add `signalfast_price_id=stripe_pro_weekly` to the weekly link metadata and its subscription metadata; use `signalfast_price_id=stripe_pro_yearly` for the yearly link. Set their URLs in `NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK` and `NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK`. Configure Stripe webhooks at `/api/webhooks/payments` and set `STRIPE_WEBHOOK_SECRET`.

Configure Yolfi's webhook endpoint to `POST https://<your-saas-domain>/api/webhooks/payments/yolfi` with the `STRIPE` adapter, then store its endpoint signing secret as `YOLFI_WEBHOOK_SECRET`. Configure the public paywall URLs with `NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK` and `NEXT_PUBLIC_YOLFI_PRO_YEARLY_PAYMENT_LINK`. Webhook plan mapping derives each Yolfi Paylink ID from the corresponding configured URL, so those URLs are the single source of truth. The mobile paywall currently displays `$8.99/week` and `$99.99/year`; keep the linked products aligned with those amounts. Apply the Prisma migrations before deploying.

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
