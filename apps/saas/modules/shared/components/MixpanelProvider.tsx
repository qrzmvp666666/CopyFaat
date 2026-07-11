"use client";

import { useSession } from "@auth/hooks/use-session";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import {
	ANALYTICS_EVENTS,
	consumePendingSignupMethod,
	disableAnalytics,
	identifyAnalyticsUser,
	initializeAnalytics,
	isAnalyticsEnabled,
	resetAnalyticsUser,
	trackAnalyticsEvent,
} from "@shared/lib/analytics";
import { useEffect, type PropsWithChildren } from "react";

export function MixpanelProvider({ children }: PropsWithChildren) {
	const { loaded, user } = useSession();
	const { userHasConsented } = useCookieConsent();

	useEffect(() => {
		if (!userHasConsented) {
			disableAnalytics();
			return;
		}

		initializeAnalytics();

		if (!loaded || !isAnalyticsEnabled()) {
			return;
		}

		if (user) {
			identifyAnalyticsUser(user);

			const pendingSignupMethod = consumePendingSignupMethod();
			if (pendingSignupMethod && user.onboardingComplete === false) {
				trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
					method: pendingSignupMethod,
				});
			}
			return;
		}

		resetAnalyticsUser();
	}, [loaded, user, userHasConsented]);

	return children;
}
