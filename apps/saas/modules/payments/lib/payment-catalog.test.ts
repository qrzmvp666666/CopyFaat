import { config } from "@repo/payments/config";
import {
	getPlanIdByProviderPriceId,
	getPlanPriceByProviderPriceId,
} from "@repo/payments/lib/provider-price-ids";
import { describe, expect, it } from "vitest";

const historicalPurchases = [
	{
		planId: "pro",
		type: "subscription",
		interval: "year",
		paymentMethod: "card",
		priceId: "price_1TpAS3ECcAFBArCTYq01JK5Z",
	},
	{
		planId: "lifetime",
		type: "one-time",
		paymentMethod: "card",
		priceId: "price_1TpATwECcAFBArCTiu8wJrLX",
	},
	{
		planId: "lifetime",
		type: "one-time",
		paymentMethod: "wechat_person",
		priceId: "qixiang_lifetime_wechat",
	},
	{
		planId: "lifetime",
		type: "one-time",
		paymentMethod: "alipay_person",
		priceId: "qixiang_lifetime_alipay",
	},
];

describe("Payment Link catalog", () => {
	it("offers only weekly and yearly Pro subscriptions", () => {
		const visible = Object.entries(config.plans).filter(([, plan]) => !plan.hidden);
		expect(visible.map(([id]) => id)).toEqual(["pro"]);
		const pro = config.plans.pro;
		expect(
			"prices" in pro &&
				pro.prices.map((price) => price.type === "subscription" && price.interval),
		).toEqual(["week", "year"]);
	});
	it("recognizes existing orders after price environment variables are removed", () => {
		for (const mapping of historicalPurchases) {
			expect(getPlanIdByProviderPriceId(mapping.priceId)).toBe(mapping.planId);
			expect(getPlanPriceByProviderPriceId(mapping.priceId)?.price.type).toBe(mapping.type);
		}
	});
	it.each(["stripe_pro_weekly", "stripe_pro_yearly", "yolfi_pro_weekly", "yolfi_pro_yearly"])(
		"recognizes Payment Link purchases: %s",
		(id) => {
			expect(getPlanIdByProviderPriceId(id)).toBe("pro");
			expect(getPlanPriceByProviderPriceId(id)?.price.type).toBe("subscription");
		},
	);
});
