import { createCustomerPortalLink } from "./procedures/create-customer-portal-link";
import { listPurchases } from "./procedures/list-purchases";
import { listRedeemHistory } from "./procedures/list-redeem-history";
import { redeemCode } from "./procedures/redeem-code";

export const paymentsRouter = {
	createCustomerPortalLink,
	listPurchases,
	listRedeemHistory,
	redeemCode,
};
