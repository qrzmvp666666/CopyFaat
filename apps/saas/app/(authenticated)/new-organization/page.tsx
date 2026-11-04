import { getOrganizationList } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { CreateOrganizationForm } from "@organizations/components/CreateOrganizationForm";
import { config } from "@repo/auth/config";
import { AuthWrapper } from "@shared/components/AuthWrapper";

export const dynamic = "force-dynamic";

export default async function NewOrganizationPage() {
	const organizations = await getOrganizationList();

	if (
		!config.organizations.enable ||
		(!config.organizations.enableUsersToCreateOrganizations &&
			(!config.organizations.requireOrganization || organizations.length > 0))
	) {
		return await redirectWithLocale("/");
	}

	return (
		<AuthWrapper>
			<CreateOrganizationForm />
		</AuthWrapper>
	);
}
