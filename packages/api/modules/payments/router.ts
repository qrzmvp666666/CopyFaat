import { createCheckoutLink } from "./procedures/create-checkout-link";
import { createCustomerPortalLink } from "./procedures/create-customer-portal-link";
import { listPurchases } from "./procedures/list-purchases";
import { listRedeemHistory } from "./procedures/list-redeem-history";
import { redeemCode } from "./procedures/redeem-code";

export const paymentsRouter = {
	createCheckoutLink,
	createCustomerPortalLink,
	listPurchases,
	listRedeemHistory,
	redeemCode,
};
