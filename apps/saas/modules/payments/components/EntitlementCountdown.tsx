"use client";

import { cn } from "@repo/ui";
import { Clock3Icon, SparklesIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface EntitlementCountdownProps {
	expiresAt: Date | string;
	compact?: boolean;
	className?: string;
}

function padTimePart(value: number) {
	return value.toString().padStart(2, "0");
}

function getRemainingParts(remainingMs: number) {
	const totalSeconds = Math.max(Math.floor(remainingMs / 1000), 0);
	const days = Math.floor(totalSeconds / 86_400);
	const hours = Math.floor((totalSeconds % 86_400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return {
		days,
		hours: padTimePart(hours),
		minutes: padTimePart(minutes),
		seconds: padTimePart(seconds),
	};
}

export function EntitlementCountdown({
	expiresAt,
	compact = false,
	className,
}: EntitlementCountdownProps) {
	const t = useTranslations("settings.billing.activePlan.countdown");
	const format = useFormatter();
	const [now, setNow] = useState<number | null>(null);
	const expiresAtDate = new Date(expiresAt);
	const remainingMs = now === null ? null : expiresAtDate.getTime() - now;

	useEffect(() => {
		setNow(Date.now());

		const timer = window.setInterval(() => {
			setNow(Date.now());
		}, 1000);

		return () => window.clearInterval(timer);
	}, []);

	if (!Number.isFinite(expiresAtDate.getTime()) || remainingMs === null || remainingMs <= 0) {
		return null;
	}

	const parts = getRemainingParts(remainingMs);
	const remaining = t(parts.days > 0 ? "remainingWithDays" : "remaining", parts);
	const label = t("label");

	if (compact) {
		return (
			<div
				className={cn(
					"gap-1.5 px-2.5 py-1.5 text-xs font-semibold flex shrink-0 items-center rounded-full border border-primary/25 bg-primary/10 text-primary",
					className,
				)}
			>
				<Clock3Icon className="size-3.5" />
				<span>{t("compact", { time: remaining })}</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"mt-3 gap-3 p-3 sm:flex-row sm:items-center sm:justify-between flex flex-col rounded-xl border bg-primary/5",
				className,
			)}
		>
			<div className="gap-3 flex items-center">
				<div className="size-9 flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
					<SparklesIcon className="size-4" />
				</div>
				<div>
					<p className="text-sm font-semibold">{label}</p>
					<p className="text-xs text-muted-foreground">
						{t("expiresAt", {
							date: format.dateTime(expiresAtDate, {
								dateStyle: "medium",
								timeStyle: "short",
							}),
						})}
					</p>
				</div>
			</div>
			<div className="font-mono text-lg font-semibold text-primary">{remaining}</div>
		</div>
	);
}
