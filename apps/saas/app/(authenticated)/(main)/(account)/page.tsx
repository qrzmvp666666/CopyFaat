import { getOrganizationList, getSession } from "@auth/lib/server";
import { config } from "@repo/auth/config";
import { redirect } from "next/navigation";

export default async function AppStartPage() {
	const session = await getSession();

	if (!session) {
		redirect("/login");
	}

	const organizations = await getOrganizationList();

	if (config.organizations.enable && config.organizations.requireOrganization) {
		const organization =
			organizations.find((org) => org.id === session?.session.activeOrganizationId) ||
			organizations[0];

		if (!organization) {
			redirect("/new-organization");
		}

		redirect(`/${organization.slug}`);
	}

	redirect("/signals");
}
