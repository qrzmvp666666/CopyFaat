// Historical product identifiers remain readable for existing purchases.
export const legacyPriceMappings = [
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
] as const;
