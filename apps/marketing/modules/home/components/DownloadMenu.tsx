"use client";

import { config } from "@config";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { ChevronDownIcon, DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const DOWNLOAD_OPTIONS = [
	{ key: "windows", url: config.downloadUrls.windows },
	{ key: "macAppleSilicon", url: config.downloadUrls.macAppleSilicon },
	{ key: "macIntel", url: config.downloadUrls.macIntel },
] as const;

export function DownloadMenu() {
	const t = useTranslations("home.island");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="island-button island-button-primary island-download-trigger">
				<DownloadIcon size={16} aria-hidden="true" />
				{t("download")}
				<ChevronDownIcon size={15} aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="center" className="island-download-menu">
				{DOWNLOAD_OPTIONS.map(({ key, url }) => (
					<DropdownMenuItem key={key} disabled={!url} asChild={Boolean(url)}>
						{url ? (
							<a href={url} download>
								{t(`downloadOptions.${key}`)}
							</a>
						) : (
							<span>{t(`downloadOptions.${key}`)}</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
