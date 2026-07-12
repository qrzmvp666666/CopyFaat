"use client";

import { useSession } from "@auth/hooks/use-session";
import {
	consumePendingSignupMethod,
	identifyAnalyticsUser,
	identifyNewAnalyticsUser,
	initializeAnalytics,
	isAnalyticsEnabled,
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
