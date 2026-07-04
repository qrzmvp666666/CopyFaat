"use client";
import { PricingTable } from "@payments/components/PricingTable";

export function ChangePlan({
	organizationId,
	userId,
	activePlanId,
	showActivePlanInPricing,
}: {
	organizationId?: string;
	userId?: string;
	activePlanId?: string;
	showActivePlanInPricing?: boolean;
}) {
	return (
		<PricingTable
			organizationId={organizationId}
			userId={userId}
			activePlanId={activePlanId}
			showActivePlanInPricing={showActivePlanInPricing}
		/>
	);
}
