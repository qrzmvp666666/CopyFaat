import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";

import { config } from "../config";
import type { PlanPrice } from "../types";
import type { PlanId } from "./plans";
import { getPlanIdByProviderPriceId, getPlanPriceByProviderPriceId } from "./provider-price-ids";

type PurchaseWithoutTimestamps = Omit<z.infer<typeof PurchaseSchema>, "createdAt" | "updatedAt">;

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const SIGNALS_ENTITLEMENT_SOURCES = new Set(["redeem_code", "signup_trial"]);

export interface ResolvedPurchase extends PurchaseWithoutTimestamps {
	createdAt?: Date | string;
	planId?: PlanId | null;
	planPrice?: PlanPrice | null;
	updatedAt?: Date | string;
}

export interface ResolvedEntitlementGrant {
	id: string;
	userId: string;
	source: string;
	planId: string;
	durationDays: number;
	startsAt: Date | string;
	expiresAt: Date | string;
	createdAt?: Date | string;
	redeemCodeId?: string | null;
}

export type MembershipAnalyticsBillingType = "entitlement" | "none" | "one_time" | "subscription";

export type MembershipAnalyticsStatus = "expired" | "free" | "paid" | "redeemed" | "trial";

export interface MembershipAnalyticsProfile {
	access_expires_at: string | null;
	billing_type: MembershipAnalyticsBillingType;
	membership_status: MembershipAnalyticsStatus;
	paid_since: string | null;
	plan_id: string;
	subscription_status: string;
	trial_expires_at: string | null;
}

function resolvePurchasePlan(purchase: ResolvedPurchase) {
	if (purchase.planId && purchase.planPrice) {
		return {
			planId: purchase.planId,
			price: purchase.planPrice,
		};
	}

	const resolvedPrice = getPlanPriceByProviderPriceId(purchase.priceId);

	if (!resolvedPrice) {
		return null;
	}

	return resolvedPrice;
}

function resolvePurchasePlanId(purchase: ResolvedPurchase) {
	if (purchase.planId) {
		return purchase.planId;
	}

	return getPlanIdByProviderPriceId(purchase.priceId);
}

function isActiveSubscriptionPurchase(purchase: ResolvedPurchase) {
	return ACTIVE_SUBSCRIPTION_STATUSES.has(purchase.status ?? "");
}

function getActivePlanFromPurchases(purchases?: ResolvedPurchase[]) {
	const subscriptionPurchase = purchases?.find(
		(purchase) => purchase.type === "SUBSCRIPTION" && isActiveSubscriptionPurchase(purchase),
	);

	if (subscriptionPurchase) {
		const resolvedPrice = resolvePurchasePlan(subscriptionPurchase);

		if (!resolvedPrice || !(resolvedPrice.planId in config.plans)) {
			return null;
		}

		return {
			id: resolvedPrice.planId,
			price: resolvedPrice.price,
			status: subscriptionPurchase.status || "active",
			purchaseId: subscriptionPurchase.id,
		};
	}

	const oneTimePurchase = purchases?.find((purchase) => purchase.type === "ONE_TIME");

	if (oneTimePurchase) {
		const resolvedPrice = resolvePurchasePlan(oneTimePurchase);

		if (!resolvedPrice || !(resolvedPrice.planId in config.plans)) {
			return null;
		}

		return {
			id: resolvedPrice.planId,
			price: resolvedPrice.price,
			status: "active",
			purchaseId: oneTimePurchase.id,
		};
	}

	if (!config.requireActiveSubscription) {
		return {
			id: "free" as PlanId,
			price: undefined,
			status: "active",
		};
	}

	return null;
}

function getActiveGrantFromEntitlements(entitlementGrants?: ResolvedEntitlementGrant[]) {
	const now = Date.now();
	const activeGrants = entitlementGrants
		?.filter((grant) => new Date(grant.expiresAt).getTime() > now)
		.sort((left, right) => {
			return new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime();
		});
	const activeGrant = activeGrants?.[0];

	if (!activeGrant || !(activeGrant.planId in config.plans)) {
		return null;
	}

	return {
		id: activeGrant.planId as PlanId,
		price: undefined,
		status: "active",
		entitlementGrantId: activeGrant.id,
		expiresAt: new Date(activeGrant.expiresAt),
		source: activeGrant.source,
	};
}

export function hasPaidSignalsAccess(
	purchases: ResolvedPurchase[],
	entitlementGrants: ResolvedEntitlementGrant[] = [],
	now = Date.now(),
) {
	const hasEligiblePurchase = purchases.some((purchase) => {
		const resolvedPrice = resolvePurchasePlan(purchase);

		if (!resolvedPrice || !(resolvedPrice.planId in config.plans)) {
			return false;
		}

		return (
			(purchase.type === "SUBSCRIPTION" &&
				resolvedPrice.price.type === "subscription" &&
				isActiveSubscriptionPurchase(purchase)) ||
			(purchase.type === "ONE_TIME" &&
				resolvedPrice.planId === "lifetime" &&
				resolvedPrice.price.type === "one-time")
		);
	});

	if (hasEligiblePurchase) {
		return true;
	}

	return entitlementGrants.some(
		(grant) =>
			SIGNALS_ENTITLEMENT_SOURCES.has(grant.source) &&
			new Date(grant.expiresAt).getTime() > now &&
			grant.planId in config.plans,
	);
}

export function createPurchasesHelper(
	purchases: ResolvedPurchase[],
	entitlementGrants: ResolvedEntitlementGrant[] = [],
) {
	const paidPurchasePlan = getActivePlanFromPurchases(purchases);
	const activeGrantPlan = getActiveGrantFromEntitlements(entitlementGrants);
	const activePlan =
		paidPurchasePlan && paidPurchasePlan.id !== "free"
			? paidPurchasePlan
			: activeGrantPlan || paidPurchasePlan;

	const hasSubscription = (planIds?: PlanId[] | PlanId) => {
		return (
			!!activePlan &&
			(Array.isArray(planIds) ? planIds.includes(activePlan.id) : planIds === activePlan.id)
		);
	};

	const hasPurchase = (planId: PlanId) => {
		return !!purchases?.some((purchase) => resolvePurchasePlanId(purchase) === planId);
	};

	return { activePlan, hasSubscription, hasPurchase };
}

/**
 * Converts payment and entitlement records into the small, stable set of
 * membership properties sent to Mixpanel. No provider identifiers or payment
 * metadata belong in this profile.
 */
export function getMembershipAnalyticsProfile(
	purchases: ResolvedPurchase[],
	entitlementGrants: ResolvedEntitlementGrant[] = [],
	now = Date.now(),
): MembershipAnalyticsProfile {
	const activeSubscriptions = purchases
		.map((purchase) => ({ purchase, resolvedPlan: resolvePurchasePlan(purchase) }))
		.filter(
			({ purchase, resolvedPlan }) =>
				purchase.type === "SUBSCRIPTION" &&
				resolvedPlan?.price.type === "subscription" &&
				ACTIVE_SUBSCRIPTION_STATUSES.has(purchase.status ?? "") &&
				resolvedPlan.planId in config.plans,
		)
		.sort((left, right) => {
			if (left.purchase.status === right.purchase.status) {
				return getRecordTime(right.purchase) - getRecordTime(left.purchase);
			}

			return left.purchase.status === "active" ? -1 : 1;
		});
	const lifetimePurchases = purchases
		.map((purchase) => ({ purchase, resolvedPlan: resolvePurchasePlan(purchase) }))
		.filter(
			({ purchase, resolvedPlan }) =>
				purchase.type === "ONE_TIME" &&
				resolvedPlan?.planId === "lifetime" &&
				resolvedPlan.price.type === "one-time",
		)
		.sort((left, right) => getRecordTime(left.purchase) - getRecordTime(right.purchase));
	const activeGrants = entitlementGrants
		.filter(
			(grant) =>
				SIGNALS_ENTITLEMENT_SOURCES.has(grant.source) &&
				grant.planId in config.plans &&
				new Date(grant.expiresAt).getTime() > now,
		)
		.sort((left, right) => {
			return new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime();
		});
	const expiredGrants = entitlementGrants
		.filter(
			(grant) =>
				SIGNALS_ENTITLEMENT_SOURCES.has(grant.source) &&
				grant.planId in config.plans &&
				new Date(grant.expiresAt).getTime() <= now,
		)
		.sort((left, right) => {
			return new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime();
		});
	const activeSubscription = activeSubscriptions.find(
		({ purchase }) => purchase.status === "active",
	);
	const trialingSubscription = activeSubscriptions.find(
		({ purchase }) => purchase.status === "trialing",
	);
	const activeRedeemGrant = activeGrants.find((grant) => grant.source === "redeem_code");
	const activeSignupTrialGrant = activeGrants.find((grant) => grant.source === "signup_trial");
	const expiredSignupTrialGrant = expiredGrants.find((grant) => grant.source === "signup_trial");
	const latestSubscription = purchases
		.filter((purchase) => purchase.type === "SUBSCRIPTION")
		.sort((left, right) => getRecordTime(right) - getRecordTime(left))[0];
	const paidSince = getPaidSince(activeSubscription?.purchase, lifetimePurchases);
	const subscriptionStatus = latestSubscription?.status ?? "none";

	if (lifetimePurchases[0]) {
		return {
			access_expires_at: null,
			billing_type: "one_time",
			membership_status: "paid",
			paid_since: paidSince,
			plan_id: "lifetime",
			subscription_status: subscriptionStatus,
			trial_expires_at: null,
		};
	}

	if (activeSubscription?.resolvedPlan) {
		return {
			access_expires_at: null,
			billing_type: "subscription",
			membership_status: "paid",
			paid_since: paidSince,
			plan_id: activeSubscription.resolvedPlan.planId,
			subscription_status: subscriptionStatus,
			trial_expires_at: null,
		};
	}

	if (trialingSubscription?.resolvedPlan) {
		return {
			access_expires_at: null,
			billing_type: "subscription",
			membership_status: "trial",
			paid_since: paidSince,
			plan_id: trialingSubscription.resolvedPlan.planId,
			subscription_status: subscriptionStatus,
			trial_expires_at: null,
		};
	}

	if (activeRedeemGrant) {
		const expiresAt = toIsoString(activeRedeemGrant.expiresAt);

		return {
			access_expires_at: expiresAt,
			billing_type: "entitlement",
			membership_status: "redeemed",
			paid_since: paidSince,
			plan_id: activeRedeemGrant.planId,
			subscription_status: subscriptionStatus,
			trial_expires_at: null,
		};
	}

	if (activeSignupTrialGrant) {
		const expiresAt = toIsoString(activeSignupTrialGrant.expiresAt);

		return {
			access_expires_at: expiresAt,
			billing_type: "entitlement",
			membership_status: "trial",
			paid_since: paidSince,
			plan_id: activeSignupTrialGrant.planId,
			subscription_status: subscriptionStatus,
			trial_expires_at: expiresAt,
		};
	}

	if (expiredGrants[0]) {
		return {
			access_expires_at: toIsoString(expiredGrants[0].expiresAt),
			billing_type: "entitlement",
			membership_status: "expired",
			paid_since: paidSince,
			plan_id: expiredGrants[0].planId,
			subscription_status: subscriptionStatus,
			trial_expires_at: expiredSignupTrialGrant
				? toIsoString(expiredSignupTrialGrant.expiresAt)
				: null,
		};
	}

	return {
		access_expires_at: null,
		billing_type: "none",
		membership_status: "free",
		paid_since: paidSince,
		plan_id: "free",
		subscription_status: subscriptionStatus,
		trial_expires_at: null,
	};
}

function getPaidSince(
	activeSubscription: ResolvedPurchase | undefined,
	lifetimePurchases: { purchase: ResolvedPurchase }[],
) {
	const paidPurchases = [
		...(activeSubscription ? [activeSubscription] : []),
		...lifetimePurchases.map(({ purchase }) => purchase),
	].sort((left, right) => getCreationTime(left) - getCreationTime(right));

	return paidPurchases[0] ? toIsoString(paidPurchases[0].createdAt) : null;
}

function getCreationTime(record: { createdAt?: Date | string; updatedAt?: Date | string }) {
	const timestamp = new Date(record.createdAt ?? record.updatedAt ?? 0).getTime();
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRecordTime(record: { createdAt?: Date | string; updatedAt?: Date | string }) {
	const timestamp = new Date(record.updatedAt ?? record.createdAt ?? 0).getTime();
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toIsoString(value: Date | string | undefined) {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
