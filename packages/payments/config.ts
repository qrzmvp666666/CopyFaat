import type { PaymentsConfig } from "./types";

export const config: PaymentsConfig = {
	billingAttachedTo: "user",
	requireActiveSubscription: false,
	plans: {
		pro: {
			prices: [
				// ── Pro Weekly (card only — WeChat/Alipay are lifetime-only) ─
				{
					type: "subscription",
					paymentMethod: "card",
					priceId: (process.env.PRICE_ID_PRO_WEEKLY_CARD ??
						process.env.PRICE_ID_PRO_WEEKLY) as string,
					interval: "week",
					amount: Number(process.env.NEXT_PUBLIC_PRICE_AMOUNT_PRO_WEEKLY_CARD ?? 6.99),
					currency: process.env.NEXT_PUBLIC_PRICE_CURRENCY_PRO_WEEKLY_CARD ?? "USD",
					seatBased: true,
					trialPeriodDays: 0,
				},
				// ── Pro Yearly (card only) ────────────────────────────────────
				{
					type: "subscription",
					paymentMethod: "card",
					priceId: (process.env.PRICE_ID_PRO_YEARLY_CARD ??
						process.env.PRICE_ID_PRO_YEARLY) as string,
					interval: "year",
					amount: Number(process.env.NEXT_PUBLIC_PRICE_AMOUNT_PRO_YEARLY_CARD ?? 49.99),
					currency: process.env.NEXT_PUBLIC_PRICE_CURRENCY_PRO_YEARLY_CARD ?? "USD",
					seatBased: true,
					trialPeriodDays: 0,
				},
			],
		},
		lifetime: {
			recommended: true,
			prices: [
				// ── Lifetime Card (Stripe) ────────────────────────────────────
				{
					type: "one-time",
					paymentMethod: "card",
					priceId: (process.env.PRICE_ID_LIFETIME_CARD ??
						process.env.PRICE_ID_LIFETIME) as string,
					amount: Number(process.env.NEXT_PUBLIC_PRICE_AMOUNT_LIFETIME_CARD ?? 199.99),
					currency: process.env.NEXT_PUBLIC_PRICE_CURRENCY_LIFETIME_CARD ?? "CNY",
				},
				// ── Lifetime WeChat (QiXiang) ─────────────────────────────────
				// priceId is a synthetic internal identifier, not a Stripe price ID.
				// Set PRICE_ID_LIFETIME_WECHAT to e.g. "qixiang_lifetime_wechat".
				{
					type: "one-time",
					paymentMethod: "wechat_person",
					priceId: process.env.PRICE_ID_LIFETIME_WECHAT as string,
					amount: Number(process.env.NEXT_PUBLIC_PRICE_AMOUNT_LIFETIME_WECHAT ?? 199.99),
					currency: process.env.NEXT_PUBLIC_PRICE_CURRENCY_LIFETIME_WECHAT ?? "CNY",
				},
				// ── Lifetime Alipay (QiXiang) ─────────────────────────────────
				// priceId is a synthetic internal identifier, not a Stripe price ID.
				// Set PRICE_ID_LIFETIME_ALIPAY to e.g. "qixiang_lifetime_alipay".
				{
					type: "one-time",
					paymentMethod: "alipay_person",
					priceId: process.env.PRICE_ID_LIFETIME_ALIPAY as string,
					amount: Number(process.env.NEXT_PUBLIC_PRICE_AMOUNT_LIFETIME_ALIPAY ?? 199.99),
					currency: process.env.NEXT_PUBLIC_PRICE_CURRENCY_LIFETIME_ALIPAY ?? "CNY",
				},
			],
		},
		enterprise: {
			isEnterprise: true,
		},
	},
};
