# Signals Webhook

Market candles and live quotes use Binance USD-M Futures contract trade prices. Historical candles come from `https://fapi.binance.com/fapi/v1/klines`; live kline and ticker streams use `wss://fstream.binance.com/market`. Mark-price candles and spot-market fallback are not used. A symbol must exist on Binance USD-M Futures for its chart to load. The pair catalog renders from stored metadata without probing candles for every pair. Historical candles load only for the selected pair and timeframe; catalog entries do not guarantee exchange availability.

`/signals` is public. Only an identified signed-in user with confirmed paid access skips onboarding and receives the full workspace. Anonymous visitors, unpaid users, and visitors whose identity or entitlement cannot be verified see the guide on every visit, regardless of previous completion. Finishing or closing it opens membership plans; dismissing those plans returns to the guide. Anonymous visitors can sign in directly from the guide or paywall.

The locked workspace renders the real layout behind a glass blur mask. It uses public exchange candles from `/api/market/klines` and allowlisted trader/symbol metadata plus up to three real signal summaries from `/api/signals/preview`. Trader choices come from active database trader profiles linked to real signals, so no sample identities are fabricated. The summaries omit entry, take-profit, stop-loss, event IDs, and private notes. Pro users load full stored signals from `GET /api/signals`, then receive webhook signals over `GET /api/signals/events`; these endpoints and `/api/signals/klines` independently verify paid access. Legacy signup trial grants do not qualify.

The guide uses transparent text and outlined actions beside the highlighted feature, choosing available space below, above, or alongside it without covering the target. It covers trader selection, filters, chart, and the full signal panel including both tabs and its list. Responsive targets highlight the visible trader controls and the mobile filter button or desktop filter inputs. The filter step names direction, time window, and entry status. The paywall shows only Pro weekly/yearly options, matching the marketing pricing section.

On mobile, the paywall offers fixed weekly and yearly Stripe Payment Links for card payment and Yolfi Paylinks for stablecoin payment. Talivia handles web-session attribution through its tracker and the payment providers' configured return URL; the paywall only pre-fills the customer's email when available. Both providers write subscription records to the shared `purchase` table. Purchases without an account remain pending claim and are linked only when the signed-in account has a verified email matching the payment email. Provider, payment link ID, email, Talivia visitor ID, subscription status, and claim status are retained on that purchase record.

The fourth onboarding screen keeps the filter demonstration visible when its animation finishes and proceeds directly to the paywall on Next. The former comparison reveal and its offer countdown are temporarily hidden with `SHOW_GUIDE_PLAN_COMPARISON = false`; the comparison below the paywall plans remains visible on desktop and mobile. The preserved onboarding comparison can be restored with that flag. It compares aggregated chart signals, chosen-KOL details, entry/exit and risk levels, filters, and reference pricing. Other-community features vary; their $49–199/month range is merchant-provided reference copy, not a verified market-wide price. The displayed Pro offer is $99/year or 8.99 USDT/week; actual billing remains controlled by checkout, not this comparison. This comparison stays within step four and adds no analytics event. Keep the saved Talivia funnel order aligned with the screen order below.

Talivia funnel events, in order: `Start Onboarding`, `Choose Traders`, `Explore Chart`, `View Signal Details`, `Filter Signals`, `Enter Paywall`, `Start Checkout`, and `Payment Success`. `Start Onboarding` fires when the guide opens; `Choose Traders` fires when the visitor advances from the trader-selection screen, so the first two funnel events have a clear temporal order. Desktop and mobile checkout use the same events. Payment completion is recorded once when a visitor returns with a checkout session ID and a pending checkout marker from this flow; the event does not wait for signup or login. Talivia attributes it to the same browser visitor using its tracker identity. The checkout session ID identifies the payment session, not the Talivia visitor, and return-page tracking is not a server-verified payment confirmation.

Talivia Bot Traffic uses the server-side `@talivia/bot-traffic` Next.js proxy integration in `apps/saas/proxy.ts`. Enable Bot traffic for this website in Talivia, create its website-scoped `tlv_bot_...` token, and set it as the server-only `TALIVIA_BOT_TOKEN` environment variable locally and in the deployment environment. `TALIVIA_DOMAIN` supplies the public origin for deployments whose incoming request host is internal. The SDK filters ordinary browser traffic, API routes, static assets, and Next.js internals by default; this reports crawler traffic and does not block requests.

Configure Stripe Payment Links with recurring weekly/yearly prices and set their public URLs in `NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK` and `NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK`. The webhook reads the Payment Link ID from `checkout.session.completed`, retrieves that Payment Link from Stripe, and matches its URL to these settings to map it to `stripe_pro_weekly` or `stripe_pro_yearly`; no Stripe Price ID or custom metadata is required for this paywall mapping. Configure Stripe webhooks at `/api/webhooks/payments` and set `STRIPE_WEBHOOK_SECRET`.

Configure Yolfi's webhook endpoint to `POST https://<your-saas-domain>/api/webhooks/payments/yolfi` with the `STRIPE` adapter, then store its endpoint signing secret as `YOLFI_WEBHOOK_SECRET`. Configure the public paywall URLs with `NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK` and `NEXT_PUBLIC_YOLFI_PRO_YEARLY_PAYMENT_LINK`. Webhook plan mapping derives each Yolfi Paylink ID from the corresponding configured URL, so those URLs are the single source of truth. The mobile paywall currently displays `$8.99/week` and `$99.99/year`; keep the linked products aligned with those amounts. Apply the Prisma migrations before deploying.

Signals are persisted through Prisma in the Postgres `signal` table. The current SSE endpoint is only the local "new signal arrived" notification channel for this Next.js process. For Supabase/serverless/multi-instance deployment, keep Prisma/Postgres as the source of truth and replace or complement local SSE with a shared event source, such as Supabase Realtime/Broadcast. Do not rely on process memory for production broadcasts across instances.

Set `SIGNAL_WEBHOOK_SECRET` to require callers to send `x-signal-webhook-secret`.

## Endpoint

`POST /api/signals/webhook`

## Batch requests and processing status

The same endpoint accepts a single signal (existing behavior), an array of signals, or `{ "signals": [...] }`. Batches contain 1–100 items and use the same secret header and per-signal validation as single requests. Items are processed sequentially in submitted order, so send an opening signal before its updates. A failed item does not roll back successful items or prevent later items from running.

Batch responses use HTTP 200 when all items are saved or ignored, and HTTP 207 when any item is invalid or fails storage. Always inspect the body: `ok` is false for partial failures, even though 207 is a 2xx status. An invalid batch container/size returns 422 before any writes. The existing single-signal response remains unchanged.

```json
{
	"ok": false,
	"receivedAt": "2026-11-15T09:00:00.000Z",
	"total": 3,
	"saved": 1,
	"ignored": 0,
	"invalid": 1,
	"failed": 1,
	"results": [
		{
			"index": 0,
			"eventId": "discord:open-1",
			"status": "saved",
			"signal": { "id": "stored-signal-id", "eventId": "discord:open-1" }
		},
		{
			"index": 1,
			"eventId": "discord:open-2",
			"status": "invalid",
			"error": "Invalid signal webhook payload.",
			"issues": {}
		},
		{
			"index": 2,
			"eventId": "discord:open-3",
			"status": "failed",
			"error": "Failed to store signal. Retry this item using the same eventId."
		}
	]
}
```

The example abbreviates `signal` and `issues`; actual saved results include the full signal and validation failures include field errors. `index` is zero-based. `saved` covers both insertions and updates. `ignored` means the existing trader-name filter excluded the item. Save the response in the collection task, fix invalid items and retry failed items with stable event IDs. After a lost response, replaying the same batch with the same IDs is supported by existing upsert semantics. Replaying old updates can overwrite newer state: preserve event order and avoid replaying outdated batches.

This is synchronous processing, not a background job. Each request now creates a persistent audit record and returns `logId` and `logStatus` (`recorded` or `unavailable`) alongside the existing response. `receivedAt` is the batch start timestamp. Confirm persisted content in the signals page; a saved result confirms storage, not delivery of an SSE notification. For serverless or multi-instance hosting, the current process-local SSE channel needs a shared event source for reliable cross-instance live updates.

The webhook runs in the SaaS Next.js application and writes via Prisma using `DATABASE_URL`. Supabase can host the PostgreSQL database; it is not required to host this route as an Edge Function.

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
- Clicking the mobile paywall writes `checkout_attribution` only when `utm_source` or an ad click ID is present; campaign/content-only and fully untagged visits do not create empty records. Talivia identifiers continue through checkout independently. The same-origin endpoint is required before an attributed checkout navigates. It does **not** create a purchase. Signed payment webhooks resolve this context and populate `purchase.attributionId`, `adPlatform`, `adClickId`, `taliviaVisitorId`, and `taliviaSessionId`; payer email still comes only from the provider.
- Yolfi carries the database ID in `metadata[attribution_id]`. Stripe preserves Talivia's `client_reference_id` session value and resolves the most recent matching provider/link snapshot at Checkout Session creation time; without a Talivia session it uses the generated `sf_` ID. Two simultaneous checkouts for the same link/session share last-touch semantics, not strict per-tab attribution. Talivia is optional; missing identifiers remain null.
- PropellerAds currently has its own server-side adapter, using the fixed approved URL in `packages/payments/lib/ad-conversions.ts`. Only the first actual positive USD subscription charge is treated as an acquisition conversion: a free trial creates no conversion, a failed first charge may convert when a later retry succeeds, and renewals or renewal retries do not create another conversion. One-time paid checkouts retain their existing conversion behavior. No foreign-currency conversion or zero-value trial is fabricated. AdsGram has a separate adapter described below; other advertisers require separate adapters.
- Both sandbox and live signed paid events can send advertiser postbacks. There is no sandbox override flag. For end-to-end testing, enter through PropellerAds' generated test banner so its test click ID reaches checkout. Sandbox payment mode alone does not make an arbitrary advertising click a test conversion; postback requests still reach the real advertiser endpoint.
- `ad_conversion` stores delivery state, amount, attempts, and errors. Unique keys and a lease suppress successful/concurrent duplicates. Failures return non-2xx after purchase persistence so provider webhook retries can retry delivery. Network ambiguity means exactly-once delivery cannot be guaranteed without advertiser-side idempotency. Monitor failed/pending rows; retries stop when the provider's retry window ends.
- Apply `20261103090000_checkout_ad_attribution` before deployment. This development database has unbaselined historical migrations: only this new additive SQL was applied locally and marked resolved. Do not run the entire historical migration chain against this existing database without first baselining it.
- Reference docs: https://docs.yolfi.com/en/paylinks/checkout-parameters and https://docs.yolfi.com/en/adapters/stripe . Browser metadata is attribution context only and never grants paid access.

## AdsGram subscription acquisition

- Use `utm_source=adsgram&click_id={click_id}&record={record_data}` on the advertising landing URL (the required AdsGram macro is `{record_data}`, without `$`). `click_id` is optional for conversion delivery; `record` is required. The `record` value is opaque: URL-encode it when building links and preserve its exact decoded value. Do not reuse a sample value or an unresolved macro for real conversions.
- The existing Marketing/SaaS browser tracker captures `record` as `adRecord` with the other advertising parameters, persists it for 30 days, and retains it on ordinary navigation. A new advertising landing replaces the previous context, including clearing an old AdsGram record if the new source is different. The browser TTL is our retention policy, not a claim about AdsGram's attribution window.
- Clicking checkout creates a `checkout_attribution` snapshot. `adRecord` is copied into `purchase` through the existing Stripe client-reference resolution or Yolfi `metadata[attribution_id]`. Neither Talivia identifiers nor client-side payment-success events determine whether a subscription was paid. The mobile checkout button has a synchronous in-flight guard and remains disabled while checkout starts; new page loads and tabs can still create new snapshots.
- Configure server-only `ADSGRAM_CONVERSION_TOKEN` in the SaaS environment. The server requests `GET https://api.adsgram.ai/confirm_conversion` with `token`, `record`, and `goaltype=2` (the documented first-purchase goal; `1` is registration). The token is never sent to browsers, stored in conversion rows, or included in stored network errors. Paid events in test mode still reach the advertiser: use AdsGram's test advertising flow for end-to-end checks.
- After a verified positive subscription invoice, `purchase.firstPaidPaymentId` is atomically recorded, including purchases without advertising context. Zero-value trials and failed invoices do not claim this marker. The first invoice that eventually succeeds can convert; different paid invoice IDs (renewals and their retries) cannot create acquisition tasks. AdsGram does not require USD or receive a fabricated exchange rate/payout; `amountMinor` and `currency` preserve the actual amount, and `amountUsd` is null for other currencies. PropellerAds retains its existing USD and one-time checkout behavior.
- `ad_conversion` uniquely constrains `(provider, subscriptionId, goal)` and `(adPlatform, adRecord, goal)` in addition to the existing payment and snapshot keys. This suppresses tasks across multiple snapshots and even across Stripe/Yolfi when the same AdsGram record is reused. This is per-subscription and per-advertising-record acquisition, not lifetime deduplication of a person across different records.
- Retries use the original task's immutable payload, increment `attempts`, and transition `pending/failed -> sending -> sent/failed`. Concurrent workers use a 60-second lease. A missing token leaves a failed task and requests provider redelivery; configure the token before launch. A renewal does not create a replacement task. Monitor failures and replay the original successful invoice webhook if the provider's automatic retry window has expired. Advertiser-side idempotency is still needed to resolve an accepted request whose response was lost.
- Apply `20261108090000_adsgram_conversions` before running the new code, then regenerate Prisma. It backfills existing conversion history, preserves trialing subscriptions' eligibility, and marks historical non-trial subscriptions without a conversion as `legacy_before_adsgram` so a renewal is not accidentally reported as acquisition. It does not invent historical payments or send retrospective conversions. The development database has unbaselined old migrations: apply only the new migration and resolve it, or baseline the history before using the full migration chain.
- Validation: enter using an AdsGram-generated link, confirm a resolved record in the snapshot/purchase, complete a trial (no conversion), then its first positive charge (one sent conversion). Replay that webhook, use a second checkout with the same record, and advance a renewal: no new advertiser delivery should occur. A failed first charge followed by successful collection must still produce its one acquisition task. Official parameter/goal reference: https://docs.adsgram.ai/zh/advertiser/web-tracking-links .

## Language-specific landing and payment return paths

- Use `/zh/signals` for Chinese and `/en/signals` for English advertising landing pages. Language paths take priority over `NEXT_LOCALE`; legacy `/signals` redirects using the valid cookie or the Chinese default. Redirects and language switching preserve the query string, including UTM and click IDs.
- UI prefixes are handled by the SaaS proxy without moving the existing route tree. API, webhook, assets, and image-proxy endpoints retain their current URLs. Use `localizePath` for local links and `redirectWithLocale` for server redirects.
- Signal filters, onboarding, mobile paywall, authentication, and payment return copy follow the selected language. Trader names and externally supplied signal text are original content, not automatic translations. Enabled locales currently match Marketing: `zh` and `en`.
- Before leaving for a Payment Link, a first-party `signalfast_checkout_locale` cookie remembers the checkout language for seven days. It is independent of a later language switch in another tab. The provider's generic `/checkout-return?session_id=...` resolves this cookie and redirects to `/en/checkout-return` or `/zh/checkout-return`. Explicit locale-prefixed return URLs, or `/checkout-return?locale=en`, can also be configured. API-created checkouts set a locale-prefixed return URL directly. Login/signup callbacks keep that path.
- Fixed Stripe/Yolfi Payment Links do not receive a fabricated dynamic return URL parameter. The return must target the same SaaS host to read its cookies. Concurrent checkouts in different languages use the latest checkout cookie for a generic return; use explicit locale-specific return links if per-checkout language isolation is required.
- Yolfi's hosted checkout uses its documented language prefix (`/zh-CN/{paylink-id}` or `/en/{paylink-id}`). The signed webhook mapping continues to use the final paylink ID. Stripe hosted checkout retains its own browser/payment-link language behavior; the application return language is handled above.

## Shared subscription checkout

All SaaS purchase entry points (`/choose-plan`, billing settings, and the signals paywall) render the same weekly/yearly Payment Link UI. Stripe card and Yolfi stablecoin checkout both use `prepareAttributedPaymentLink`; the legacy dynamic checkout RPC is retired. Marketing forwards visitors to the locale-specific `/choose-plan` page. Product price/amount environment variables are no longer required. The hidden lifetime catalog and historical product identifier mappings exist only to recognize previous purchases.

OAuth login and account linking are shown only when both credentials for the provider are configured. Restart the SaaS development server (or rebuild production) after changing provider credentials; only availability booleans are exposed to the browser.

Both desktop and mobile paywalls use the same pricing component, which repeats the four onboarding feature comparisons plus desktop/mobile support in a compact table below the plan cards. Pro feature checkmarks include an Auto label; the desktop/mobile row uses Included. Its Pro column follows the paywall’s cyan accent; pricing remains in the selectable plan cards above the table. The table stays in the scrollable content area above the fixed checkout footer and reuses the onboarding comparison translations.

Desktop and mobile paywalls show two scrolling rows above payment methods: public KOL trader avatars/names first, then active contract symbols/logos. Both use `/api/signals/preview`, whose symbol metadata comes from the active trading-symbol catalog so contracts without recent signals remain visible. Loading uses a placeholder; failed or empty responses do not invent traders or symbols.

The paywall footer shows a seven-day countdown above checkout on desktop and mobile. It starts on the first paywall visit and persists its deadline in `signalfast:paywall-offer-deadline:v1` localStorage. Expired deadlines stay expired. The timer is presentation only; it does not change provider prices or enforce offer eligibility.

## Admin webhook call history

Administrators can open `/zh/admin/webhook-logs` or `/en/admin/webhook-logs` from the SaaS admin menu. The page shows call totals, completed calls, calls needing attention, and processing calls; supports status filters, search by log ID/event ID/KOL/symbol, pagination, and per-item detail including signal IDs and validation errors. It refreshes every 15 seconds; a processing detail refreshes every 5 seconds. All displayed times use Asia/Shanghai. Only calls received after enabling logging are available.

Both list and detail use `adminProcedure` under `admin.webhookLogs`; the page inherits the existing admin layout guard. The `signal_webhook_log` table is server-only with RLS enabled and no browser Data API policies. Apply `20261115120000_signal_webhook_logs` before deploying this version. No secrets, authorization headers, cookies, or raw malformed request bodies are stored. Submitted fields are allowlisted and bounded (note: 500 characters, other text: 200, source name/platform: 80); unknown fields are omitted. Logs are diagnostic snapshots, not lossless request archives or automatic replay payloads.

Unauthenticated requests, malformed JSON and invalid batch envelopes appear as rejected calls with no submitted items. Authorized calls that cannot create an audit record return 503 without processing signals. If finalizing the audit record fails after signal processing, the actual processing response is preserved with `logStatus: "unavailable"`; server logs include the log ID, and the admin record may remain processing. Processing records with no completion can also indicate interrupted requests; verify signals before retrying. There is no automatic retry button or background queue.

## Discord name-based KOL bindings

Manage bindings under **Admin → KOL source bindings** (`/zh/admin/source-bindings`, or `/en/admin/source-bindings`). Each binding links platform + server name + channel name + optional category to an **existing** Trader. The desktop page uses a compact table for platform, server, channel, KOL, status, and actions; mobile uses a divided list. Admins can create, edit, search, or disable bindings; both procedures enforce the admin role. No Discord numeric IDs are needed.

Discord submissions must include these source fields (alongside the existing signal contract):

```json
{
	"source": {
		"platform": "discord",
		"serverName": "币圈策略搬运工",
		"channelName": "三马哥合约",
		"name": "三马哥"
	}
}
```

The binding determines KOL identity; submitted `name` or `id` cannot replace it. Existing Trader names, external IDs, and historical signals are preserved. Non-Discord submissions without named channel fields retain the legacy identity path.

Names use Unicode NFKC, trim/collapse whitespace, remove zero-width characters, and ignore case. Channel names additionally ignore boundary 📈/📉 decorations. There is no fuzzy matching. If the same server/channel has multiple category bindings, provide `source.categoryName`; when provided, category must match exactly after normalization. Unknown sources never auto-create KOLs. A renamed channel needs its binding updated.

Single-item source errors return HTTP 422 with `code`; batch items return `status: "invalid"` and the same code while other items continue:

- `SOURCE_INCOMPLETE`: missing server/channel names.
- `SOURCE_UNBOUND`: no matching binding.
- `SOURCE_AMBIGUOUS`: multiple bindings; supply category.
- `SOURCE_DISABLED`: binding or KOL disabled.
- `EVENT_SOURCE_CONFLICT`: the explicit event ID belongs to another KOL.

Webhook logs retain bounded source names and per-item codes for troubleshooting. Apply `20261115150000_signal_source_bindings` before deploying this version. The table has RLS enabled with server-only access; browser clients must use the admin API. On existing unbaselined development databases, apply only the reviewed additive migration and mark it resolved rather than replaying historical migrations.
