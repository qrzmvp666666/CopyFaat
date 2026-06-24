import { RedeemCodePanel } from "@payments/components/RedeemCodePanel";
import { PageHeader } from "@shared/components/PageHeader";
import { SettingsList } from "@shared/components/SettingsList";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations("settings.billing.redeemCode");

	return {
		title: t("title"),
	};
}

export default async function RedeemCodePage() {
	const t = await getTranslations("settings.billing.redeemCode");

	return (
		<>
			<PageHeader title={t("title")} subtitle={t("pageDescription")} />

			<SettingsList>
				<RedeemCodePanel />
			</SettingsList>
		</>
	);
}
