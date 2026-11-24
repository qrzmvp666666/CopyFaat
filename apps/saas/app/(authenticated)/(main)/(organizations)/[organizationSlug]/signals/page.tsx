import { redirectWithLocale } from "@i18n/redirect";

export default async function OrganizationSignalsPage() {
	return await redirectWithLocale("/settings/billing");
}
