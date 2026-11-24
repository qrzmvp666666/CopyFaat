import { getOrganizationList, getSession } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { config } from "@repo/auth/config";

export default async function AppStartPage() {
	const session = await getSession();

	if (!session) {
		return await redirectWithLocale("/login");
	}

	const organizations = await getOrganizationList();

	if (config.organizations.enable && config.organizations.requireOrganization) {
		const organization =
			organizations.find((org) => org.id === session?.session.activeOrganizationId) ||
			organizations[0];

		if (!organization) {
			return await redirectWithLocale("/new-organization");
		}

		return await redirectWithLocale(`/${organization.slug}`);
	}

	return await redirectWithLocale("/settings/billing");
}
