"use client";

import { config } from "@config";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import {
	ANALYTICS_EVENTS,
	initializeAnalytics,
	rememberPendingSignupMethod,
	trackAnalyticsEvent,
} from "@shared/lib/analytics";
import { parseAsString, useQueryState } from "nuqs";

import { oAuthProviders } from "../constants/oauth-providers";

export function SocialSigninButton({
	provider,
	className,
	flow,
}: {
	provider: keyof typeof oAuthProviders;
	className?: string;
	flow: "login" | "signup";
}) {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const { userHasConsented } = useCookieConsent();
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.redirectAfterSignIn;

	const onSignin = async () => {
		if (flow === "signup" && userHasConsented) {
			initializeAnalytics();
			trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_SUBMITTED, {
				invitation: Boolean(invitationId),
				method: provider,
			});
			rememberPendingSignupMethod(provider);
		}

		const callbackURL = new URL(redirectPath, window.location.origin);
		await authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<Button onClick={() => onSignin()} variant="secondary" type="button" className={className}>
			{providerData.icon && (
				<i className="mr-2 text-primary">
					<providerData.icon className="size-4" />
				</i>
			)}
			{providerData.name}
		</Button>
	);
}
