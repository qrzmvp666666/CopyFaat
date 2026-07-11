"use client";

import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST;
const PENDING_SIGNUP_METHOD_KEY = "signalfast:analytics:pending-signup-method";
let isAnalyticsInitialized = false;

interface AnalyticsUser {
	email: string;
	id: string;
	name?: string | null;
	onboardingComplete?: boolean;
}

export type AnalyticsSignupMethod = "github" | "google" | "magic_link" | "password";

export const ANALYTICS_EVENTS = {
	ONBOARDING_COMPLETED: "onboarding_completed",
	SIGNAL_FEED_VIEWED: "signal_feed_viewed",
	SIGNUP_COMPLETED: "signup_completed",
	SIGNUP_FORM_VIEWED: "signup_form_viewed",
	SIGNUP_SUBMITTED: "signup_submitted",
} as const;

export interface AnalyticsEventProperties {
	invitation?: boolean;
	method?: AnalyticsSignupMethod;
	status?: "empty" | "loaded";
}

export function isAnalyticsEnabled() {
	return Boolean(MIXPANEL_TOKEN && isAnalyticsInitialized);
}

export function initializeAnalytics() {
	if (!MIXPANEL_TOKEN) {
		return;
	}

	mixpanel.init(MIXPANEL_TOKEN, {
		api_host: MIXPANEL_API_HOST ?? "https://api-eu.mixpanel.com",
		persistence: "localStorage",
		track_pageview: true,
	});
	isAnalyticsInitialized = true;
}

export function identifyAnalyticsUser(user: AnalyticsUser) {
	if (!isAnalyticsEnabled()) {
		return;
	}

	mixpanel.identify(user.id);
	mixpanel.people.set({
		$email: user.email,
		...(user.name ? { $name: user.name } : {}),
	});
}

export function resetAnalyticsUser() {
	if (!isAnalyticsEnabled()) {
		return;
	}

	mixpanel.reset();
}

export function disableAnalytics() {
	if (!isAnalyticsEnabled()) {
		return;
	}

	mixpanel.opt_out_tracking();
	mixpanel.reset();
}

export function trackAnalyticsEvent(
	event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
	properties?: AnalyticsEventProperties,
) {
	if (!isAnalyticsEnabled()) {
		return;
	}

	mixpanel.track(event, properties);
}

export function rememberPendingSignupMethod(method: AnalyticsSignupMethod) {
	if (!isAnalyticsEnabled()) {
		return;
	}

	window.sessionStorage.setItem(PENDING_SIGNUP_METHOD_KEY, method);
}

export function consumePendingSignupMethod(): AnalyticsSignupMethod | null {
	const method = window.sessionStorage.getItem(PENDING_SIGNUP_METHOD_KEY);
	window.sessionStorage.removeItem(PENDING_SIGNUP_METHOD_KEY);

	return method === "github" ||
		method === "google" ||
		method === "magic_link" ||
		method === "password"
		? method
		: null;
}
