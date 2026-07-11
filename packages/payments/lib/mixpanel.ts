import { getEntitlementGrantsByUserId, getPurchasesByUserId, getUserById } from "@repo/database";
import { logger } from "@repo/logs";

import { getMembershipAnalyticsProfile, type MembershipAnalyticsProfile } from "./helper";

const DEFAULT_MIXPANEL_API_HOST = "https://api-eu.mixpanel.com";

export const MEMBERSHIP_ANALYTICS_EVENTS = {
	PAID: "membership_paid",
	REDEEMED: "membership_redeemed",
	TRIAL_STARTED: "membership_trial_started",
} as const;

type MembershipAnalyticsEvent =
	(typeof MEMBERSHIP_ANALYTICS_EVENTS)[keyof typeof MEMBERSHIP_ANALYTICS_EVENTS];

interface MixpanelUser {
	email: string;
	id: string;
	name: string | null;
}

interface UserMembershipAnalyticsData {
	profile: MembershipAnalyticsProfile;
	user: MixpanelUser;
}

interface MembershipAnalyticsEventOptions {
	insertId?: string;
	occurredAt?: Date | string;
}

/**
 * Updates a user's Mixpanel profile from authoritative server-side payment and
 * entitlement records. Analytics failures are deliberately non-blocking.
 */
export async function syncMembershipAnalyticsProfile(userId: string) {
	try {
		const data = await getUserMembershipAnalyticsData(userId);

		if (!data) {
			return null;
		}

		await sendMixpanelProfile(data.user, data.profile);

		return data.profile;
	} catch (error) {
		logger.warn("Mixpanel membership profile synchronization failed", { error, userId });
		return null;
	}
}

/**
 * Records a membership lifecycle event and writes the corresponding profile
 * snapshot together so funnels and current-state cohorts agree.
 */
export async function recordMembershipAnalyticsEvent(
	userId: string,
	event: MembershipAnalyticsEvent,
	options: MembershipAnalyticsEventOptions = {},
) {
	try {
		const data = await getUserMembershipAnalyticsData(userId);

		if (!data) {
			return null;
		}

		await Promise.all([
			sendMixpanelProfile(data.user, data.profile),
			sendMixpanelEvent(data.user.id, event, data.profile, options),
		]);

		return data.profile;
	} catch (error) {
		logger.warn("Mixpanel membership event synchronization failed", { event, error, userId });
		return null;
	}
}

async function getUserMembershipAnalyticsData(
	userId: string,
): Promise<UserMembershipAnalyticsData | null> {
	const [user, purchases, entitlementGrants] = await Promise.all([
		getUserById(userId),
		getPurchasesByUserId(userId),
		getEntitlementGrantsByUserId(userId),
	]);

	if (!user) {
		return null;
	}

	return {
		profile: getMembershipAnalyticsProfile(purchases, entitlementGrants),
		user: {
			email: user.email,
			id: user.id,
			name: user.name ?? null,
		},
	};
}

async function sendMixpanelProfile(user: MixpanelUser, profile: MembershipAnalyticsProfile) {
	const config = getMixpanelConfig();

	if (!config) {
		return;
	}

	const propertiesToUnset = [
		...(profile.access_expires_at ? [] : ["access_expires_at"]),
		...(profile.trial_expires_at ? [] : ["trial_expires_at"]),
	];
	const profileProperties = {
		$email: user.email,
		...(user.name ? { $name: user.name } : {}),
		billing_type: profile.billing_type,
		membership_status: profile.membership_status,
		plan_id: profile.plan_id,
		subscription_status: profile.subscription_status,
		...(profile.access_expires_at ? { access_expires_at: profile.access_expires_at } : {}),
		...(profile.trial_expires_at ? { trial_expires_at: profile.trial_expires_at } : {}),
	};

	await postToMixpanel(config, "/engage", {
		$distinct_id: user.id,
		$set: profileProperties,
		...(profile.paid_since ? { $set_once: { paid_since: profile.paid_since } } : {}),
		...(propertiesToUnset.length > 0 ? { $unset: propertiesToUnset } : {}),
		$token: config.token,
	});
}

async function sendMixpanelEvent(
	userId: string,
	event: MembershipAnalyticsEvent,
	profile: MembershipAnalyticsProfile,
	options: MembershipAnalyticsEventOptions,
) {
	const config = getMixpanelConfig();

	if (!config) {
		return;
	}

	const eventTimestamp = getEventTimestamp(options.occurredAt);

	await postToMixpanel(config, "/track", [
		{
			event,
			properties: {
				billing_type: profile.billing_type,
				distinct_id: userId,
				membership_status: profile.membership_status,
				plan_id: profile.plan_id,
				...(options.insertId ? { $insert_id: options.insertId } : {}),
				...(eventTimestamp ? { $time: eventTimestamp } : {}),
				$token: config.token,
			},
		},
	]);
}

function getEventTimestamp(value: Date | string | undefined) {
	if (!value) {
		return null;
	}

	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
}

async function postToMixpanel(
	config: { apiHost: string; token: string },
	path: string,
	payload: unknown,
) {
	try {
		const response = await fetch(`${config.apiHost}${path}?verbose=1`, {
			body: new URLSearchParams({ data: JSON.stringify(payload) }),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			method: "POST",
		});

		if (!response.ok) {
			logger.warn("Mixpanel membership analytics request failed", {
				path,
				status: response.status,
			});
		}
	} catch (error) {
		logger.warn("Mixpanel membership analytics request failed", {
			error,
			path,
		});
	}
}

function getMixpanelConfig() {
	const token = process.env.MIXPANEL_TOKEN ?? process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

	if (!token) {
		return null;
	}

	return {
		apiHost: (
			process.env.MIXPANEL_API_HOST ??
			process.env.NEXT_PUBLIC_MIXPANEL_API_HOST ??
			DEFAULT_MIXPANEL_API_HOST
		).replace(/\/$/, ""),
		token,
	};
}
