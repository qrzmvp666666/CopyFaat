import { listPurchases as listPurchasesProcedure } from "@repo/api/modules/payments/procedures/list-purchases";
import { listRedeemHistory as listRedeemHistoryProcedure } from "@repo/api/modules/payments/procedures/list-redeem-history";
import { headers } from "next/headers";
import { cache } from "react";

export const listPurchases = cache(async (organizationId?: string) => {
	const purchases = await listPurchasesProcedure.callable({
		context: { headers: await headers() },
	})({
		organizationId,
	});

	return purchases;
});

export const listRedeemHistory = cache(async () => {
	const redeemHistory = await listRedeemHistoryProcedure.callable({
		context: { headers: await headers() },
	})({});

	return redeemHistory;
});
