import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

export const usePurchases = (organizationId?: string) => {
	const { data } = useQuery(
		orpc.payments.listPurchases.queryOptions({
			input: {
				organizationId,
			},
		}),
	);

	const purchases = data?.purchases ?? [];
	const entitlementGrants = data?.entitlementGrants ?? [];

	const { activePlan, hasSubscription, hasPurchase } = createPurchasesHelper(
		purchases,
		entitlementGrants,
	);

	return { purchases, entitlementGrants, activePlan, hasSubscription, hasPurchase };
};

export const useUserPurchases = () => usePurchases();

export const useOrganizationPurchases = (organizationId: string) => usePurchases(organizationId);
