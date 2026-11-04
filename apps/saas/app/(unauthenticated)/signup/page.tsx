import { SignupForm } from "@auth/components/SignupForm";
import { getInvitation } from "@auth/lib/server";
import { localizePath } from "@i18n/routing";
import { config } from "@repo/auth/config";
import type { Locale } from "@repo/i18n";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { withQuery } from "ufo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations("auth.signup");

	return {
		title: t("title"),
	};
}
export default async function SignupPage({
	searchParams,
}: {
	searchParams: Promise<{
		[key: string]: string | string[] | undefined;
		invitationId?: string;
	}>;
}) {
	const params = await searchParams;
	const locale = (await getLocale()) as Locale;
	const { invitationId } = params;

	if (!(config.enableSignup || invitationId)) {
		redirect(withQuery(localizePath("/login", locale), params));
	}

	if (invitationId) {
		const invitation = await getInvitation(invitationId);

		if (
			!invitation ||
			invitation.status !== "pending" ||
			invitation.expiresAt.getTime() < Date.now()
		) {
			redirect(withQuery(localizePath("/login", locale), params));
		}

		return <SignupForm prefillEmail={invitation.email} />;
	}

	return <SignupForm />;
}
