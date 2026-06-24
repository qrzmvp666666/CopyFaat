import {
	getEntitlementGrantsByUserId,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
} from "@repo/database";
import { getPlanIdByProviderPriceId, getPlanPriceByProviderPriceId } from "@repo/payments";
import { z } from "zod";

import { protectedProcedure } from "../../../orpc/procedures";

export const listPurchases = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/purchases",
		tags: ["Payments"],
		summary: "Get purchases",
		description: "Get all purchases of the current user or the provided organization",
	})
	.input(
		z.object({
			organizationId: z.string().optional(),
		}),
	)
	.handler(async ({ input: { organizationId }, context: { user } }) => {
		const purchases = organizationId
			? await getPurchasesByOrganizationId(organizationId)
			: await getPurchasesByUserId(user.id);
		const entitlementGrants = organizationId ? [] : await getEntitlementGrantsByUserId(user.id);

		return {
			purchases: purchases.map((purchase) => ({
				...purchase,
				planId: getPlanIdByProviderPriceId(purchase.priceId),
				planPrice: getPlanPriceByProviderPriceId(purchase.priceId)?.price ?? null,
			})),
			entitlementGrants,
		};
	});
