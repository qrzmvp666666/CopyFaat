import { z } from "zod";

import { protectedProcedure } from "../../../orpc/procedures";

export const redeemCode = protectedProcedure
	.route({
		method: "POST",
		path: "/payments/redeem-codes/redeem",
		tags: ["Payments"],
		summary: "Redeem a code",
	})
	.input(
		z.object({
			code: z.string().trim().min(1).max(64),
		}),
	)
	.handler(() => {
		return { ok: false, reason: "not_found" as const };
	});
