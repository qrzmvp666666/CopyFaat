import {
	hasPaidSignalsAccess,
	type ResolvedEntitlementGrant,
	type ResolvedPurchase,
} from "@repo/payments/lib/helper";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-07-11T12:00:00.000Z").getTime();

function createPurchase(overrides: Partial<ResolvedPurchase> = {}): ResolvedPurchase {
	return {
		customerId: "customer_1",
		id: "purchase_1",
		organizationId: null,
		planId: "pro",
		planPrice: {
			amount: 19.99,
			currency: "CNY",
			interval: "week",
			type: "subscription",
		},
		priceId: "price_pro_monthly",
		status: "active",
		subscriptionId: "subscription_1",
		type: "SUBSCRIPTION",
		userId: "user_1",
		...overrides,
	};
}

function createEntitlementGrant(
	overrides: Partial<ResolvedEntitlementGrant> = {},
): ResolvedEntitlementGrant {
	return {
		durationDays: 30,
		expiresAt: new Date(NOW + 24 * 60 * 60 * 1000),
		id: "grant_1",
		planId: "pro",
		source: "redeem_code",
		startsAt: new Date(NOW),
		userId: "user_1",
		...overrides,
	};
}

describe("hasPaidSignalsAccess", () => {
	it("allows active and trialing subscriptions", () => {
		expect(hasPaidSignalsAccess([createPurchase()], [], NOW)).toBe(true);
		expect(hasPaidSignalsAccess([createPurchase({ status: "trialing" })], [], NOW)).toBe(true);
	});

	it("allows a one-time lifetime purchase", () => {
		expect(
			hasPaidSignalsAccess(
				[
					createPurchase({
						planId: "lifetime",
						planPrice: {
							amount: 199.99,
							currency: "CNY",
							type: "one-time",
						},
						status: null,
						subscriptionId: null,
						type: "ONE_TIME",
					}),
				],
				[],
				NOW,
			),
		).toBe(true);
	});

	it("allows valid paid redemption and signup trial entitlements", () => {
		expect(hasPaidSignalsAccess([], [createEntitlementGrant()], NOW)).toBe(true);
		expect(
			hasPaidSignalsAccess([], [createEntitlementGrant({ source: "signup_trial" })], NOW),
		).toBe(true);
	});

	it("denies expired, unsupported, and inactive records", () => {
		expect(hasPaidSignalsAccess([createPurchase({ status: "canceled" })], [], NOW)).toBe(false);
		expect(
			hasPaidSignalsAccess([], [createEntitlementGrant({ expiresAt: new Date(NOW) })], NOW),
		).toBe(false);
		expect(hasPaidSignalsAccess([], [createEntitlementGrant({ source: "manual" })], NOW)).toBe(
			false,
		);
		expect(
			hasPaidSignalsAccess(
				[
					createPurchase({
						planPrice: {
							amount: 19.99,
							currency: "CNY",
							type: "one-time",
						},
						status: null,
						subscriptionId: null,
						type: "ONE_TIME",
					}),
				],
				[],
				NOW,
			),
		).toBe(false);
	});
});
