import { config } from "@config";
import { cn, Toaster } from "@repo/ui";
import { AdAttributionTracker } from "@shared/components/AdAttributionTracker";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ClientProviders } from "@shared/components/ClientProviders";
import { PwaServiceWorkerRegistration } from "@shared/components/PwaServiceWorkerRegistration";
import { TaliviaTracker } from "@shared/components/TaliviaTracker";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

import "./globals.css";
import "cropperjs/dist/cropper.css";

export const metadata: Metadata = {
	applicationName: config.appName,
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: config.appName,
	},
	manifest: "/manifest.webmanifest",
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

export const viewport: Viewport = {
	themeColor: "#121212",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

const taliviaWebsiteId = process.env.TALIVIA_WEBSITE_ID;
const taliviaDomain = process.env.TALIVIA_DOMAIN;
const taliviaCrossDomainDomains = taliviaDomain
	? Array.from(
			new Set([
				taliviaDomain,
				taliviaDomain.startsWith("www.") ? taliviaDomain.slice(4) : `www.${taliviaDomain}`,
			]),
		).join(",")
	: undefined;

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale} suppressHydrationWarning>
			<body className={cn("min-h-screen bg-background text-foreground antialiased")}>
				<AdAttributionTracker />
				<PwaServiceWorkerRegistration />
				{taliviaWebsiteId && taliviaDomain && (
					<TaliviaTracker
						websiteId={taliviaWebsiteId}
						domain={taliviaDomain}
						crossDomainDomains={taliviaCrossDomainDomains}
					/>
				)}
				<NuqsAdapter>
					<NextIntlClientProvider locale={locale} messages={messages}>
						<ThemeProvider
							attribute="class"
							disableTransitionOnChange
							enableSystem
							defaultTheme={config.defaultTheme}
							themes={Array.from(config.enabledThemes)}
						>
							<ApiClientProvider>
								<ClientProviders>
									{children}

									<Toaster position="top-right" />
								</ClientProviders>
							</ApiClientProvider>
						</ThemeProvider>
					</NextIntlClientProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
