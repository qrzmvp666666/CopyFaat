import { syncMembershipAnalyticsProfile } from "@repo/payments/lib/mixpanel";

import { protectedProcedure } from "../../../orpc/procedures";

export const syncMembershipProfile = protectedProcedure
	.route({
		method: "POST",
		path: "/analytics/membership-profile/sync",
		tags: ["Analytics"],
		summary: "Synchronize the current user's Mixpanel membership profile",
	})
	.handler(async ({ context: { user } }) => {
		await syncMembershipAnalyticsProfile(user.id);

		return { ok: true };
	});
