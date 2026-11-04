import { redirectWithLocale } from "@i18n/redirect";
import { OrganizationInvitationModal } from "@organizations/components/OrganizationInvitationModal";
import { auth } from "@repo/auth";
import { getOrganizationById } from "@repo/database";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { headers } from "next/headers";

export default async function OrganizationInvitationPage({
	params,
}: {
	params: Promise<{ invitationId: string }>;
}) {
	const { invitationId } = await params;

	const invitation = await auth.api.getInvitation({
		query: {
			id: invitationId,
		},
		headers: await headers(),
	});

	if (!invitation) {
		return await redirectWithLocale("/");
	}

	const organization = await getOrganizationById(invitation.organizationId);

	return (
		<AuthWrapper>
			<OrganizationInvitationModal
				organizationName={invitation.organizationName}
				organizationSlug={invitation.organizationSlug}
				logoUrl={organization?.logo || undefined}
				invitationId={invitationId}
			/>
		</AuthWrapper>
	);
}
