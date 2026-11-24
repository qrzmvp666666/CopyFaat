import { config } from "@config";
import { cn } from "@repo/ui";
import type { PropsWithChildren } from "react";

import { BrandLogo } from "./BrandLogo";
import { Footer } from "./Footer";
import { LocaleSwitch } from "./LocaleSwitch";

export function AuthWrapper({
	children,
	contentClass,
	unframed = false,
}: PropsWithChildren<{ contentClass?: string; unframed?: boolean }>) {
	return (
		<div className="auth-dark-shell dark py-6 flex min-h-dvh w-full bg-background text-foreground">
			<div className="gap-8 flex w-full flex-col items-center justify-between">
				<div className="relative z-0 container">
					<div className="flex items-center justify-between">
						<a href={config.marketingUrl ?? "/"} className="block">
							<BrandLogo />
						</a>

						<div className="gap-2 flex items-center justify-end">
							<LocaleSwitch />
						</div>
					</div>
				</div>

				<div className="pointer-events-auto relative z-10 container flex justify-center">
					<main
						className={cn(
							"pointer-events-auto relative z-10 w-full",
							!unframed &&
								"max-w-md p-6 lg:p-8 shadow-xl shadow-black/10 rounded-2xl border bg-card",
							contentClass,
						)}
					>
						{children}
					</main>
				</div>

				<Footer />
			</div>
		</div>
	);
}
