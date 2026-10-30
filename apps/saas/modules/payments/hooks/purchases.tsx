import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

export const usePurchases = (organizationId?: string) => {
	const { user } = useSession();
	const { data } = useQuery({
		...orpc.payments.listPurchases.queryOptions({
			input: {
				organizationId,
			},
		}),
		enabled: Boolean(user),
	});

	const purchases = data?.purchases ?? [];
	const entitlementGrants = data?.entitlementGrants ?? [];
	const activeEntitlementGrant =
		entitlementGrants
			.filter(
				(grant) =>
					grant.source !== "signup_trial" &&
					new Date(grant.expiresAt).getTime() > Date.now(),
			)
			.sort((left, right) => {
				return new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime();
			})[0] ?? null;

	const { activePlan, hasSubscription, hasPurchase } = createPurchasesHelper(
		purchases,
		entitlementGrants,
	);

	return {
		purchases,
		entitlementGrants,
		activeEntitlementGrant,
		activePlan,
		hasSubscription,
		hasPurchase,
	};
};

export const useUserPurchases = () => usePurchases();

export const useOrganizationPurchases = (organizationId: string) => usePurchases(organizationId);
import { useSession } from "@auth/hooks/use-session";
