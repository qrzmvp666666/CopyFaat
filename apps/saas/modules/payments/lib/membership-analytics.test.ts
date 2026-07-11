import {
	getMembershipAnalyticsProfile,
	type ResolvedEntitlementGrant,
	type ResolvedPurchase,
} from "@repo/payments/lib/helper";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-07-12T00:00:00.000Z").getTime();

function createPurchase(overrides: Partial<ResolvedPurchase> = {}): ResolvedPurchase {
	return {
		createdAt: new Date("2026-07-10T00:00:00.000Z"),
		customerId: "customer_1",
		id: "purchase_1",
		organizationId: null,
		planId: "pro",
		planPrice: {
			amount: 19.99,
			currency: "CNY",
			interval: "month",
			type: "subscription",
		},
		priceId: "price_pro_monthly",
		status: "active",
		subscriptionId: "subscription_1",
		type: "SUBSCRIPTION",
		updatedAt: new Date("2026-07-10T00:00:00.000Z"),
		userId: "user_1",
		...overrides,
	};
}

function createEntitlementGrant(
	overrides: Partial<ResolvedEntitlementGrant> = {},
): ResolvedEntitlementGrant {
	return {
		durationDays: 2,
		expiresAt: new Date(NOW + 24 * 60 * 60 * 1000),
		id: "grant_1",
		planId: "pro",
		source: "signup_trial",
		startsAt: new Date(NOW - 24 * 60 * 60 * 1000),
		userId: "user_1",
		...overrides,
	};
}

describe("getMembershipAnalyticsProfile", () => {
	it("maps an active signup trial to a time-bounded trial profile", () => {
		const profile = getMembershipAnalyticsProfile([], [createEntitlementGrant()], NOW);

		expect(profile).toEqual({
			access_expires_at: "2026-07-13T00:00:00.000Z",
			billing_type: "entitlement",
			membership_status: "trial",
			paid_since: null,
			plan_id: "pro",
			subscription_status: "none",
			trial_expires_at: "2026-07-13T00:00:00.000Z",
		});
	});

	it("prefers a lifetime purchase over temporary subscription and trial access", () => {
		const profile = getMembershipAnalyticsProfile(
			[
				createPurchase(),
				createPurchase({
					createdAt: new Date("2026-07-09T00:00:00.000Z"),
					id: "purchase_lifetime",
					planId: "lifetime",
					planPrice: {
						amount: 199.99,
						currency: "CNY",
						type: "one-time",
					},
					priceId: "price_lifetime",
					status: null,
					subscriptionId: null,
					type: "ONE_TIME",
				}),
			],
			[createEntitlementGrant()],
			NOW,
		);

		expect(profile).toMatchObject({
			access_expires_at: null,
			billing_type: "one_time",
			membership_status: "paid",
			paid_since: "2026-07-09T00:00:00.000Z",
			plan_id: "lifetime",
			trial_expires_at: null,
		});
	});

	it("maps an active subscription to paid and clears trial fields", () => {
		const profile = getMembershipAnalyticsProfile(
			[createPurchase()],
			[createEntitlementGrant()],
			NOW,
		);

		expect(profile).toMatchObject({
			access_expires_at: null,
			billing_type: "subscription",
			membership_status: "paid",
			paid_since: "2026-07-10T00:00:00.000Z",
			plan_id: "pro",
			subscription_status: "active",
			trial_expires_at: null,
		});
	});

	it("keeps redeemed access separate from paid users", () => {
		const profile = getMembershipAnalyticsProfile(
			[],
			[createEntitlementGrant({ source: "redeem_code" })],
			NOW,
		);

		expect(profile).toMatchObject({
			billing_type: "entitlement",
			membership_status: "redeemed",
			plan_id: "pro",
			trial_expires_at: null,
		});
	});

	it("treats a platform trial as a trial and an expired grant as expired", () => {
		const platformTrial = getMembershipAnalyticsProfile(
			[createPurchase({ status: "trialing" })],
			[],
			NOW,
		);
		const expiredGrant = getMembershipAnalyticsProfile(
			[],
			[
				createEntitlementGrant({
					expiresAt: new Date(NOW),
				}),
			],
			NOW,
		);

		expect(platformTrial).toMatchObject({
			billing_type: "subscription",
			membership_status: "trial",
			subscription_status: "trialing",
		});
		expect(expiredGrant).toMatchObject({
			billing_type: "entitlement",
			membership_status: "expired",
			plan_id: "pro",
		});
	});
});
