"use client";

import { cn } from "@repo/ui";

export function PageHeader({
	title,
	subtitle,
	className,
}: {
	title: string;
	subtitle?: string;
	className?: string;
}) {
	return (
		<div className={cn("mb-8", className)}>
			<h2 className="font-medium text-2xl tracking-tight lg:text-3xl">{title}</h2>
			<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
		</div>
	);
}
