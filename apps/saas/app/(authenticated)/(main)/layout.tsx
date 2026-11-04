import { getOrganizationList, getSession } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { config as authConfig } from "@repo/auth/config";
import type { PropsWithChildren } from "react";

export default async function MainLayout({ children }: PropsWithChildren) {
	const session = await getSession();

	if (!session) {
		return await redirectWithLocale("/login");
	}

	if (authConfig.users.enableOnboarding && !session.user.onboardingComplete) {
		return await redirectWithLocale("/onboarding");
	}

	const organizations = await getOrganizationList();

	if (authConfig.organizations.enable && authConfig.organizations.requireOrganization) {
		const organization =
			organizations.find((org) => org.id === session?.session.activeOrganizationId) ||
			organizations[0];

		if (!organization) {
			return await redirectWithLocale("/new-organization");
		}
	}

	return children;
}
