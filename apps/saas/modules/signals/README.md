# Signals Webhook

`/signals` is public. Only an identified signed-in user with confirmed paid access skips onboarding and receives the full workspace. Anonymous visitors, unpaid users, and visitors whose identity or entitlement cannot be verified see the guide on every visit, regardless of previous completion. Finishing or closing it opens membership plans; dismissing those plans returns to the guide. Anonymous visitors can sign in directly from the guide or paywall.

The locked workspace renders the real layout behind a glass blur mask. It uses public exchange candles from `/api/market/klines` and allowlisted trader/symbol metadata plus up to three real signal summaries from `/api/signals/preview`. Trader choices come from active database trader profiles linked to real signals, so no sample identities are fabricated. The summaries omit entry, take-profit, stop-loss, event IDs, and private notes. Pro users load full stored signals from `GET /api/signals`, then receive webhook signals over `GET /api/signals/events`; these endpoints and `/api/signals/klines` independently verify paid access. Legacy signup trial grants do not qualify.

The guide uses transparent text and outlined actions beside the highlighted feature, choosing available space below, above, or alongside it without covering the target. It covers trader selection, filters, chart, and the full signal panel including both tabs and its list. Responsive targets highlight the visible trader controls and the mobile filter button or desktop filter inputs. The filter step names direction, time window, and entry status. The paywall shows only Pro weekly/yearly options, matching the marketing pricing section.

On mobile, the paywall offers fixed weekly and yearly Stripe Payment Links for card payment and Yolfi Paylinks for stablecoin payment. Talivia handles web-session attribution through its tracker and the payment providers' configured return URL; the paywall only pre-fills the customer's email when available. Both providers write subscription records to the shared `purchase` table. Purchases without an account remain pending claim and are linked only when the signed-in account has a verified email matching the payment email. Provider, payment link ID, email, Talivia visitor ID, subscription status, and claim status are retained on that purchase record.

The fourth onboarding screen reveals a free-preview versus Pro comparison after the filter animation finishes. It compares live candles, chosen-KOL signals, complete price/risk details, and filters; preview examples are not paid signal access. This comparison stays within step four and adds no analytics event. Keep the saved Talivia funnel order aligned with the screen order below.

Talivia funnel events, in order: `Start Onboarding`, `Choose Traders`, `Explore Chart`, `View Signal Details`, `Filter Signals`, `Enter Paywall`, `Start Checkout`, and `Payment Success`. `Start Onboarding` fires when the guide opens; `Choose Traders` fires when the visitor advances from the trader-selection screen, so the first two funnel events have a clear temporal order. Desktop and mobile checkout use the same events. Payment completion is recorded once when a visitor returns with a checkout session ID and a pending checkout marker from this flow; the event does not wait for signup or login. Talivia attributes it to the same browser visitor using its tracker identity. The checkout session ID identifies the payment session, not the Talivia visitor, and return-page tracking is not a server-verified payment confirmation.

Talivia Bot Traffic uses the server-side `@talivia/bot-traffic` Next.js proxy integration in `apps/saas/proxy.ts`. Enable Bot traffic for this website in Talivia, create its website-scoped `tlv_bot_...` token, and set it as the server-only `TALIVIA_BOT_TOKEN` environment variable locally and in the deployment environment. `TALIVIA_DOMAIN` supplies the public origin for deployments whose incoming request host is internal. The SDK filters ordinary browser traffic, API routes, static assets, and Next.js internals by default; this reports crawler traffic and does not block requests.

Configure Stripe Payment Links with recurring weekly/yearly prices and set their public URLs in `NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK` and `NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK`. The webhook reads the Payment Link ID from `checkout.session.completed`, retrieves that Payment Link from Stripe, and matches its URL to these settings to map it to `stripe_pro_weekly` or `stripe_pro_yearly`; no Stripe Price ID or custom metadata is required for this paywall mapping. Configure Stripe webhooks at `/api/webhooks/payments` and set `STRIPE_WEBHOOK_SECRET`.

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

## Advertising attribution and payment-link conversions

- Marketing and SaaS capture `utm_*` and `click_id` (also `gclid`, `fbclid`, `ttclid`, `msclkid`) as last-touch context, with a 30-day first-party cookie. On `signalfast.cn` it is shared with subdomains. Unrelated tunnel domains cannot share this cookie; test on the SaaS landing URL or explicitly preserve campaign parameters between sites.
- Clicking the mobile paywall writes `checkout_attribution` through a same-origin public endpoint before navigating (2.5-second timeout, fail-open). It does **not** create a purchase. Signed payment webhooks resolve this context and populate `purchase.attributionId`, `adPlatform`, `adClickId`, `taliviaVisitorId`, and `taliviaSessionId`; payer email still comes only from the provider.
- Yolfi carries the database ID in `metadata[attribution_id]`. Stripe preserves Talivia's `client_reference_id` session value and resolves the most recent matching provider/link snapshot at Checkout Session creation time; without a Talivia session it uses the generated `sf_` ID. Two simultaneous checkouts for the same link/session share last-touch semantics, not strict per-tab attribution. Talivia is optional; missing identifiers remain null.
- PropellerAds currently has its own server-side adapter, using the fixed approved URL in `packages/payments/lib/ad-conversions.ts`. Only click ID and actual positive USD minor-unit amount change. No foreign-currency conversion, zero-value trial conversion, or automatic renewal acquisition conversion is fabricated. Other advertisers require separate adapters.
- Both sandbox and live signed paid events can send advertiser postbacks. There is no sandbox override flag. For end-to-end testing, enter through PropellerAds' generated test banner so its test click ID reaches checkout. Sandbox payment mode alone does not make an arbitrary advertising click a test conversion; postback requests still reach the real advertiser endpoint.
- `ad_conversion` stores delivery state, amount, attempts, and errors. Unique keys and a lease suppress successful/concurrent duplicates. Failures return non-2xx after purchase persistence so provider webhook retries can retry delivery. Network ambiguity means exactly-once delivery cannot be guaranteed without advertiser-side idempotency. Monitor failed/pending rows; retries stop when the provider's retry window ends.
- Apply `20261103090000_checkout_ad_attribution` before deployment. This development database has unbaselined historical migrations: only this new additive SQL was applied locally and marked resolved. Do not run the entire historical migration chain against this existing database without first baselining it.
- Reference docs: https://docs.yolfi.com/en/paylinks/checkout-parameters and https://docs.yolfi.com/en/adapters/stripe . Browser metadata is attribution context only and never grants paid access.

## Language-specific landing and payment return paths

- Use `/zh/signals` for Chinese and `/en/signals` for English advertising landing pages. Language paths take priority over `NEXT_LOCALE`; legacy `/signals` redirects using the valid cookie or the Chinese default. Redirects and language switching preserve the query string, including UTM and click IDs.
- UI prefixes are handled by the SaaS proxy without moving the existing route tree. API, webhook, assets, and image-proxy endpoints retain their current URLs. Use `localizePath` for local links and `redirectWithLocale` for server redirects.
- Signal filters, onboarding, mobile paywall, authentication, and payment return copy follow the selected language. Trader names and externally supplied signal text are original content, not automatic translations. Enabled locales currently match Marketing: `zh` and `en`.
- Before leaving for a Payment Link, a first-party `signalfast_checkout_locale` cookie remembers the checkout language for seven days. It is independent of a later language switch in another tab. The provider's generic `/checkout-return?session_id=...` resolves this cookie and redirects to `/en/checkout-return` or `/zh/checkout-return`. Explicit locale-prefixed return URLs, or `/checkout-return?locale=en`, can also be configured. API-created checkouts set a locale-prefixed return URL directly. Login/signup callbacks keep that path.
- Fixed Stripe/Yolfi Payment Links do not receive a fabricated dynamic return URL parameter. The return must target the same SaaS host to read its cookies. Concurrent checkouts in different languages use the latest checkout cookie for a generic return; use explicit locale-specific return links if per-checkout language isolation is required.
- Yolfi's hosted checkout uses its documented language prefix (`/zh-CN/{paylink-id}` or `/en/{paylink-id}`). The signed webhook mapping continues to use the final paylink ID. Stripe hosted checkout retains its own browser/payment-link language behavior; the application return language is handled above.
