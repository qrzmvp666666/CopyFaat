import { countAllUsers, getEntitlementGrantsByUserId, getUsers } from "@repo/database";
import { logger } from "@repo/logs";

import type { MembershipAnalyticsProfile } from "../lib/helper";
import {
	recordMembershipAnalyticsEvent,
	MEMBERSHIP_ANALYTICS_EVENTS,
	syncMembershipAnalyticsProfile,
} from "../lib/mixpanel";

const BATCH_SIZE = 100;

interface BackfillAnalyticsEvent {
	event:
		| typeof MEMBERSHIP_ANALYTICS_EVENTS.REDEEMED
		| typeof MEMBERSHIP_ANALYTICS_EVENTS.TRIAL_STARTED;
	insertId: string;
	occurredAt: Date;
}

async function main() {
	const userCount = await countAllUsers({});
	let eventCount = 0;
	let syncedCount = 0;

	for (let offset = 0; offset < userCount; offset += BATCH_SIZE) {
		const users = await getUsers({ limit: BATCH_SIZE, offset });

		for (const user of users) {
			const entitlementGrants = await getEntitlementGrantsByUserId(user.id);
			const analyticsEvents: BackfillAnalyticsEvent[] = [];

			for (const grant of entitlementGrants) {
				if (grant.source === "signup_trial") {
					analyticsEvents.push({
						event: MEMBERSHIP_ANALYTICS_EVENTS.TRIAL_STARTED,
						insertId: `signup-trial:${grant.id}`,
						occurredAt: grant.startsAt,
					});
					continue;
				}

				if (grant.source === "redeem_code") {
					analyticsEvents.push({
						event: MEMBERSHIP_ANALYTICS_EVENTS.REDEEMED,
						insertId: `redeem:${grant.id}`,
						occurredAt: grant.startsAt,
					});
				}
			}

			let profile: MembershipAnalyticsProfile | null = null;

			for (const analyticsEvent of analyticsEvents) {
				profile = await recordMembershipAnalyticsEvent(user.id, analyticsEvent.event, {
					insertId: analyticsEvent.insertId,
					occurredAt: analyticsEvent.occurredAt,
				});
				eventCount += 1;
			}

			profile ??= await syncMembershipAnalyticsProfile(user.id);

			if (profile) {
				syncedCount += 1;
			}
		}
	}

	logger.log("Mixpanel membership profile backfill completed", {
		eventCount,
		syncedCount,
		userCount,
	});
}

main().catch((error) => {
	logger.error("Mixpanel membership profile backfill failed", error);
	process.exitCode = 1;
});
