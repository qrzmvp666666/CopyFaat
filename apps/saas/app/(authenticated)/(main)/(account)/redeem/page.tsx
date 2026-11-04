import { redirectWithLocale } from "@i18n/redirect";

export default async function RedeemCodePage() {
	return await redirectWithLocale("/settings/billing");
}
