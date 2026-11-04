import { getSession } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { ChangeEmailForm } from "@settings/components/ChangeEmailForm";
import { ChangeNameForm } from "@settings/components/ChangeNameForm";
import { DeleteAccountForm } from "@settings/components/DeleteAccountForm";
import { UserAvatarForm } from "@settings/components/UserAvatarForm";
import { UserLanguageForm } from "@settings/components/UserLanguageForm";
import { PageHeader } from "@shared/components/PageHeader";
import { SettingsList } from "@shared/components/SettingsList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations("settings.account");

	return {
		title: t("title"),
	};
}

export default async function AccountSettingsPage() {
	const session = await getSession();

	if (!session) {
		return await redirectWithLocale("/login");
	}

	const t = await getTranslations("settings.account");

	return (
		<>
			<PageHeader title={t("title")} subtitle={t("subtitle")} />

			<SettingsList>
				<UserAvatarForm />
				<UserLanguageForm />
				<ChangeNameForm />
				<ChangeEmailForm />
				<DeleteAccountForm />
			</SettingsList>
		</>
	);
}
