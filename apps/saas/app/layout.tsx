import { config } from "@config";
import { cn, Toaster } from "@repo/ui";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ClientProviders } from "@shared/components/ClientProviders";
import { PwaServiceWorkerRegistration } from "@shared/components/PwaServiceWorkerRegistration";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
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
	themeColor: "#141414",
	viewportFit: "cover",
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();

	return (
		<html lang={locale} suppressHydrationWarning>
			<body className={cn("min-h-screen bg-background text-foreground antialiased")}>
				<PwaServiceWorkerRegistration />
				<Script
					src="https://datafa.st/js/script.js"
					data-website-id="dfid_fb2tp0jNLHKxFdogSJxxe"
					data-domain="www.signalfast.cn"
					strategy="afterInteractive"
				/>
				<Script
					src="https://talivia.com/script.js"
					data-website-id="46cfdef2-8ed5-4a66-957e-b5e7b85f2295"
					data-domain="www.signalfast.cn"
					data-cross-domain-domains="www.signalfast.cn,signalfast.cn"
					strategy="afterInteractive"
				/>
				<NuqsAdapter>
					<NextIntlClientProvider messages={messages}>
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
