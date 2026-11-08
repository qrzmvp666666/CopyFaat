import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	purchase: { findUnique: vi.fn(), updateMany: vi.fn() },
	getPurchase: vi.fn(),
	updatePurchase: vi.fn(),
	report: vi.fn(),
	resolve: vi.fn(),
	upsertPurchase: vi.fn(),
	claim: vi.fn(),
	logError: vi.fn(),
	constructEvent: vi.fn(),
	retrieveSubscription: vi.fn(),
	retrievePaymentLink: vi.fn(),
}));
vi.mock("@repo/database", () => ({
	db: { purchase: mocks.purchase },
	getPurchaseBySubscriptionId: mocks.getPurchase,
	updatePurchase: mocks.updatePurchase,
}));
vi.mock("@repo/logs", () => ({ logger: { error: mocks.logError } }));
vi.mock("../../../../../packages/payments/lib/ad-conversions", () => ({
	reportAdConversion: mocks.report,
}));
vi.mock("../../../../../packages/payments/lib/attribution", () => ({
	resolvePaymentAttribution: mocks.resolve,
}));
vi.mock("../../../../../packages/payments/lib/customer", () => ({
	setCustomerIdToEntity: vi.fn(),
}));
vi.mock("../../../../../packages/payments/lib/purchases", () => ({
	upsertSubscriptionPurchase: mocks.upsertPurchase,
	claimPendingPurchases: mocks.claim,
}));
import {
	webhookHandler as stripeWebhook,
	getStripeClient,
} from "../../../../../packages/payments/provider/stripe";
import { yolfiWebhookHandler } from "../../../../../packages/payments/provider/yolfi";

const attribution = { attributionId: "sf_adsgram", adPlatform: "adsgram", adRecord: "R001" };
const purchase = {
	id: "purchase",
	provider: "stripe",
	subscriptionId: "sub_test",
	type: "SUBSCRIPTION",
	status: "trialing",
	...attribution,
};

beforeEach(() => {
	vi.resetAllMocks();
	vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_mock");
	vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_mock");
	vi.spyOn(getStripeClient().subscriptions, "retrieve").mockImplementation(
		mocks.retrieveSubscription,
	);
	vi.stubEnv("YOLFI_WEBHOOK_SECRET", "yolfi-test-secret");
	vi.stubEnv("NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK", "https://pay.yolfi.com/test-paylink");
	mocks.getPurchase.mockResolvedValue(purchase);
	mocks.purchase.findUnique.mockResolvedValue(null);
	mocks.resolve.mockResolvedValue(attribution);
	mocks.retrieveSubscription.mockResolvedValue({ status: "active" });
});
afterEach(() => vi.unstubAllEnvs());

function stripeRequest(type: string, object: Record<string, unknown>) {
	const body = JSON.stringify({ id: "evt_test", type, data: { object } });
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = createHmac("sha256", "whsec_mock")
		.update(`${timestamp}.${body}`)
		.digest("hex");
	return new Request("https://app.example/api/webhooks/payments", {
		method: "POST",
		body,
		headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
	});
}
function yolfiRequest(type: string, amount = 899, validSignature = true) {
	const body = JSON.stringify({
		id: "evt_test",
		type,
		created: 1794120000,
		data: {
			object: {
				id: "in_first",
				subscription: "sub_test",
				amount_paid: amount,
				currency: "usd",
				metadata: { attribution_id: "sf_adsgram", yolfi_paylink_id: "test-paylink" },
			},
		},
	});
	const signature = createHmac("sha256", "yolfi-test-secret").update(body).digest("base64");
	return new Request("https://app.example/api/webhooks/payments/yolfi", {
		method: "POST",
		body,
		headers: { "X-Yolfi-Signature": validSignature ? signature : "invalid" },
	});
}

describe("Stripe subscription acquisition", () => {
	it("passes stored record and subscription ID from a confirmed invoice to the delivery gate", async () => {
		const response = await stripeWebhook(
			stripeRequest("invoice.paid", {
				id: "in_first",
				amount_paid: 899,
				currency: "usd",
				parent: { subscription_details: { subscription: "sub_test" } },
			}),
		);
		expect(mocks.logError.mock.calls).toEqual([]);
		expect(response.status).toBe(204);
		expect(mocks.report).toHaveBeenCalledWith(
			expect.objectContaining({
				...attribution,
				provider: "stripe",
				paymentId: "in_first",
				subscriptionId: "sub_test",
				amountMinor: 899,
			}),
		);
	});
	it("does not send when only subscription status becomes active", async () => {
		expect(
			(
				await stripeWebhook(
					stripeRequest("customer.subscription.updated", {
						id: "sub_test",
						status: "active",
					}),
				)
			).status,
		).toBe(204);
		expect(mocks.report).not.toHaveBeenCalled();
	});
	it("does not send for failed invoices", async () => {
		expect(
			(
				await stripeWebhook(
					stripeRequest("invoice.payment_failed", { subscription: "sub_test" }),
				)
			).status,
		).toBe(204);
		expect(mocks.report).not.toHaveBeenCalled();
	});
	it("requests redelivery if paid invoice precedes checkout persistence", async () => {
		mocks.getPurchase.mockResolvedValue(null);
		expect(
			(
				await stripeWebhook(
					stripeRequest("invoice.paid", {
						id: "in_first",
						subscription: "sub_test",
						amount_paid: 899,
						currency: "usd",
					}),
				)
			).status,
		).toBe(500);
	});
	it("requests redelivery on advertiser failure after persisting purchase status", async () => {
		mocks.report.mockRejectedValue(new Error("retry webhook"));
		expect(
			(
				await stripeWebhook(
					stripeRequest("invoice.paid", {
						id: "in_first",
						subscription: "sub_test",
						amount_paid: 899,
						currency: "usd",
					}),
				)
			).status,
		).toBe(500);
		expect(mocks.updatePurchase).toHaveBeenCalled();
	});
	it("rejects unverified webhook signatures without reporting", async () => {
		const request = stripeRequest("invoice.paid", {});
		request.headers.set("stripe-signature", "invalid");
		expect((await stripeWebhook(request)).status).toBe(400);
		expect(mocks.report).not.toHaveBeenCalled();
	});
});

describe("Yolfi subscription acquisition", () => {
	it.each(["invoice.paid", "invoice.payment_succeeded"])(
		"preserves record on %s",
		async (type) => {
			expect((await yolfiWebhookHandler(yolfiRequest(type))).status).toBe(204);
			expect(mocks.upsertPurchase).toHaveBeenCalledWith(expect.objectContaining(attribution));
			expect(mocks.report).toHaveBeenCalledWith(
				expect.objectContaining({
					...attribution,
					provider: "yolfi",
					subscriptionId: "sub_test",
					paymentId: "in_first",
					amountMinor: 899,
				}),
			);
		},
	);
	it("uses the frozen purchase attribution when renewal metadata is absent or different", async () => {
		mocks.purchase.findUnique.mockResolvedValue({ ...purchase, provider: "yolfi" });
		mocks.resolve.mockResolvedValue({ attributionId: "sf_other", adRecord: "other" });
		expect((await yolfiWebhookHandler(yolfiRequest("invoice.paid"))).status).toBe(204);
		expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining(attribution));
	});
	it("returns 503 on advertiser failure, allowing retry of the original paid event", async () => {
		mocks.report.mockRejectedValue(new Error("retry webhook"));
		expect((await yolfiWebhookHandler(yolfiRequest("invoice.paid"))).status).toBe(503);
		expect(mocks.upsertPurchase).toHaveBeenCalled();
	});
	it("rejects an invalid HMAC before writing or reporting", async () => {
		expect((await yolfiWebhookHandler(yolfiRequest("invoice.paid", 899, false))).status).toBe(
			400,
		);
		expect(mocks.upsertPurchase).not.toHaveBeenCalled();
		expect(mocks.report).not.toHaveBeenCalled();
	});
});
