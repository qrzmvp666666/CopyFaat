import "server-only";
import type { Locale } from "@repo/i18n";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { localizePath } from "./routing";

export async function redirectWithLocale(path: string): Promise<never> {
	redirect(localizePath(path, (await getLocale()) as Locale));
}
