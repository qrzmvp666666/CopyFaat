"use client";

import { updateLocale } from "@i18n/lib/update-locale";
import { localizePath } from "@i18n/routing";
import type { Locale } from "@repo/i18n";
import { config as i18nConfig } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { LanguagesIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";

export function LocaleSwitch() {
	const currentLocale = useLocale();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	if (Object.keys(i18nConfig.locales).length <= 1) {
		return null;
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={currentLocale === "zh" ? "切换语言" : "Change language"}
				>
					<LanguagesIcon className="size-4" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent>
				<DropdownMenuRadioGroup
					value={currentLocale}
					onValueChange={async (value) => {
						await updateLocale(value as Locale);
						const query = searchParams.toString();
						window.location.assign(
							`${localizePath(pathname, value as Locale)}${query ? `?${query}` : ""}${window.location.hash}`,
						);
					}}
				>
					{Object.entries(i18nConfig.locales).map(([locale, { label }]) => {
						return (
							<DropdownMenuRadioItem key={locale} value={locale}>
								{label}
							</DropdownMenuRadioItem>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
