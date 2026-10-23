"use client";

import { config } from "@config";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { parseAsString, useQueryState } from "nuqs";

import { oAuthProviders } from "../constants/oauth-providers";
import { clearTaliviaSignupPending, markTaliviaSignupPending } from "../lib/talivia";

export function SocialSigninButton({
	provider,
	className,
	isSignup = false,
}: {
	provider: keyof typeof oAuthProviders;
	className?: string;
	isSignup?: boolean;
}) {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.redirectAfterSignIn;

	const onSignin = async () => {
		const callbackURL = new URL(redirectPath, window.location.origin);

		if (isSignup) {
			markTaliviaSignupPending();
		}

		try {
			const { error } = await authClient.signIn.social({
				provider,
				callbackURL: callbackURL.toString(),
			});

			if (error) {
				throw error;
			}
		} catch (error) {
			if (isSignup) {
				clearTaliviaSignupPending();
			}

			throw error;
		}
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
