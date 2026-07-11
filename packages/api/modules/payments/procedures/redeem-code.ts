import { ORPCError } from "@orpc/client";
import { redeemCodeForUser } from "@repo/database";
import { config as paymentsConfig } from "@repo/payments/config";
import {
	recordMembershipAnalyticsEvent,
	MEMBERSHIP_ANALYTICS_EVENTS,
} from "@repo/payments/lib/mixpanel";
import { z } from "zod";

import { protectedProcedure } from "../../../orpc/procedures";
import { hashRedeemCode, normalizeRedeemCode } from "../lib/redeem-code";

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
	.handler(async ({ input: { code }, context: { user } }) => {
		const normalizedCode = normalizeRedeemCode(code);

		if (normalizedCode.length < 8) {
			throw new ORPCError("BAD_REQUEST");
		}

		const result = await redeemCodeForUser({
			userId: user.id,
			codeHash: hashRedeemCode(normalizedCode),
		});

		if (!result.ok) {
			return result;
		}

		if (!(result.entitlementGrant.planId in paymentsConfig.plans)) {
			throw new ORPCError("BAD_REQUEST");
		}

		await recordMembershipAnalyticsEvent(user.id, MEMBERSHIP_ANALYTICS_EVENTS.REDEEMED, {
			insertId: `redeem:${result.entitlementGrant.id}`,
		});

		return result;
	});
