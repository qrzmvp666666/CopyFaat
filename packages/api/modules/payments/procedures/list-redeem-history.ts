import { getEntitlementGrantsByUserId } from "@repo/database";
import { z } from "zod";

import { protectedProcedure } from "../../../orpc/procedures";

export const listRedeemHistory = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/redeem-codes/history",
		tags: ["Payments"],
		summary: "List redeemed codes",
	})
	.input(z.object({}))
	.handler(async ({ context: { user } }) => {
		return getEntitlementGrantsByUserId(user.id);
	});
