"use client";

import { cn } from "@repo/ui";
import {
	BarChart2Icon,
	BookOpenIcon,
	BuildingIcon,
	DatabaseIcon,
	FileTextIcon,
	GlobeIcon,
	HardDriveIcon,
	KeyIcon,
	ReceiptIcon,
	RocketIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const TAB_KEYS = [
	"multiTenant",
	"database",
	"storage",
	"auth",
	"payment",
	"blog",
	"docs",
	"seo",
	"deploy",
	"analytics",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

const TAB_ICONS: Record<TabKey, React.ElementType> = {
	multiTenant: BuildingIcon,
	database: DatabaseIcon,
	storage: HardDriveIcon,
	auth: KeyIcon,
	payment: ReceiptIcon,
	blog: FileTextIcon,
	docs: BookOpenIcon,
	seo: GlobeIcon,
	deploy: RocketIcon,
	analytics: BarChart2Icon,
};

export function HeroTabs() {
	const t = useTranslations();
	const [active, setActive] = useState<TabKey>("multiTenant");

	return (
		<div className="gap-1 px-2 py-1.5 backdrop-blur-sm scrollbar-none md:justify-center flex items-center justify-start overflow-x-auto rounded-full border bg-muted/60 [-webkit-overflow-scrolling:touch]">
			{TAB_KEYS.map((key) => {
				const Icon = TAB_ICONS[key];
				const isActive = active === key;
				return (
					<button
						key={key}
						type="button"
						onClick={() => setActive(key)}
						className={cn(
							"gap-1.5 px-3 py-1.5 text-xs font-medium flex shrink-0 items-center rounded-full transition-all",
							isActive
								? "shadow-sm border border-border bg-background text-foreground"
								: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
						)}
					>
						<Icon className="size-3.5 shrink-0" />
						<span>{t(`home.hero.tabs.${key}`)}</span>
						{isActive && (
							<span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
						)}
					</button>
				);
			})}
		</div>
	);
}
