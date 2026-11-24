import { redirectWithLocale } from "@i18n/redirect";

export default async function SignalsPage() {
	return await redirectWithLocale("/settings/billing");
}
