import { getSession } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { OnboardingForm } from "@onboarding/components/OnboardingForm";
import { config } from "@repo/auth/config";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations("onboarding");

	return {
		title: t("title"),
	};
}

export default async function OnboardingPage() {
	const session = await getSession();

	if (!session) {
		return await redirectWithLocale("/login");
	}

	if (!config.users.enableOnboarding || session.user.onboardingComplete) {
		return await redirectWithLocale("/");
	}

	return (
		<AuthWrapper>
			<OnboardingForm />
		</AuthWrapper>
	);
}
