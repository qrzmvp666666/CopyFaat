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
	planId?: PlanId | null;
	planPrice?: PlanPrice | null;
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
