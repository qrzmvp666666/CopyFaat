import { config } from "@config";
import { cn, Toaster } from "@repo/ui";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentBanner } from "@shared/components/ConsentBanner";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { cookies } from "next/headers";

import "./globals.css";
import "cropperjs/dist/cropper.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();
	const analyticsNotice = (await cookies()).get("analytics-notice")?.value;

	return (
		<html lang={locale} suppressHydrationWarning>
			<body className={cn("min-h-screen bg-background text-foreground antialiased")}>
				<NuqsAdapter>
					<ConsentProvider initialNotice={analyticsNotice}>
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

										<ConsentBanner
											privacyPolicyUrl={
												config.marketingUrl
													? `${config.marketingUrl}/legal/privacy-policy`
													: undefined
											}
										/>
									</ClientProviders>
								</ApiClientProvider>
							</ThemeProvider>
						</NextIntlClientProvider>
					</ConsentProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
