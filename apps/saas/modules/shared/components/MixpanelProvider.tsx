"use client";

import { useSession } from "@auth/hooks/use-session";
import {
	ANALYTICS_EVENTS,
	consumePendingSignupMethod,
	identifyAnalyticsUser,
	identifyNewAnalyticsUser,
	initializeAnalytics,
	isAnalyticsEnabled,
	trackAnalyticsEvent,
} from "@shared/lib/analytics";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, type PropsWithChildren } from "react";

export function MixpanelProvider({ children }: PropsWithChildren) {
	const { loaded, user } = useSession();
	const synchronizedUserIdRef = useRef<string | null>(null);
	const { mutate: syncMembershipProfile } = useMutation(
		orpc.analytics.syncMembershipProfile.mutationOptions(),
	);

	useEffect(() => {
		initializeAnalytics();

		if (!loaded || !isAnalyticsEnabled()) {
			return;
		}

		if (user) {
			const pendingSignupMethod = consumePendingSignupMethod();
			if (pendingSignupMethod && user.onboardingComplete === false) {
				identifyNewAnalyticsUser(user);
				trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
					method: pendingSignupMethod,
				});
				return;
			}

			identifyAnalyticsUser(user);
		}
	}, [loaded, user]);

	useEffect(() => {
		if (!loaded) {
			return;
		}

		if (!user) {
			synchronizedUserIdRef.current = null;
			return;
		}

		if (synchronizedUserIdRef.current === user.id) {
			return;
		}

		synchronizedUserIdRef.current = user.id;
		syncMembershipProfile({});
	}, [loaded, syncMembershipProfile, user]);

	return children;
}
