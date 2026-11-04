import { config as i18nConfig } from "@repo/i18n";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

import { getMessagesForLocale } from "./lib/messages";
import { isSupportedLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
	let locale = await requestLocale;

	if (!locale) {
		const cookieStore = await cookies();
		const localeCookie = cookieStore.get(i18nConfig.localeCookieName);
		locale = localeCookie?.value ?? i18nConfig.defaultLocale;
	}

	if (!isSupportedLocale(locale)) {
		locale = i18nConfig.defaultLocale;
	}

	return {
		locale,
		messages: await getMessagesForLocale(locale),
	};
});
