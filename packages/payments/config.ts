import type { PaymentsConfig } from "./types";

export const config: PaymentsConfig = {
	billingAttachedTo: "user",
	requireActiveSubscription: false,
	plans: {
		pro: {
			prices: [
				{
					type: "subscription",
					paymentMethod: "card",
					priceId: "stripe_pro_weekly",
					interval: "week",
					amount: 8.99,
					currency: "USD",
					trialPeriodDays: 0,
				},
				{
					type: "subscription",
					paymentMethod: "card",
					priceId: "stripe_pro_yearly",
					interval: "year",
					amount: 99.99,
					currency: "USD",
					trialPeriodDays: 0,
				},
			],
		},
		// Preserve access for historical lifetime purchases; new checkouts offer Pro only.
		lifetime: {
			hidden: true,
			prices: [
				{
					type: "one-time",
					paymentMethod: "card",
					priceId: "legacy_lifetime_card",
					amount: 199.99,
					currency: "CNY",
				},
				{
					type: "one-time",
					paymentMethod: "wechat_person",
					priceId: "legacy_lifetime_wechat",
					amount: 199.99,
					currency: "CNY",
				},
				{
					type: "one-time",
					paymentMethod: "alipay_person",
					priceId: "legacy_lifetime_alipay",
					amount: 199.99,
					currency: "CNY",
				},
			],
		},
	},
};
