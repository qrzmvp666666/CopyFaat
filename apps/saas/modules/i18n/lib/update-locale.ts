"use server";

import { config as i18nConfig, type Locale } from "@repo/i18n";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isSupportedLocale } from "../routing";

export async function updateLocale(locale: Locale) {
	if (!isSupportedLocale(locale)) return;
	(await cookies()).set(i18nConfig.localeCookieName, locale, {
		path: "/",
		sameSite: "lax",
		maxAge: 31536000,
	});
	revalidatePath("/");
}
