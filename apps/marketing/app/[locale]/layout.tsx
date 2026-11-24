import { AnalyticsScript } from "@analytics";
import { config } from "@config";
import { config as i18nConfig } from "@i18n/config";
import { cn, Toaster } from "@repo/ui";
import { AdAttributionTracker } from "@shared/components/AdAttributionTracker";
import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import { Footer } from "@shared/components/Footer";
import { NavBar } from "@shared/components/NavBar";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Script from "next/script";
import type { PropsWithChildren } from "react";

const locales = Object.keys(i18nConfig.locales) as string[];
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

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

export default async function MarketingLayout({
	children,
	params,
}: PropsWithChildren<{ params: Promise<{ locale: string }> }>) {
	const { locale } = await params;

	if (!locales.includes(locale)) {
		notFound();
	}

	setRequestLocale(locale);

	const messages = await getMessages();

	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");

	return (
		<html lang={locale} suppressHydrationWarning className={cn(config.defaultTheme)}>
			<body className={cn("min-h-screen bg-background text-foreground antialiased")}>
				<AdAttributionTracker />
				{taliviaWebsiteId && taliviaDomain && (
					<Script
						src="https://talivia.com/script.js"
						data-website-id={taliviaWebsiteId}
						data-domain={taliviaDomain}
						data-cross-domain-domains={taliviaCrossDomainDomains}
						strategy="afterInteractive"
					/>
				)}
				<ConsentProvider
					initialConsent={consentCookie?.value === "true"}
					initialConsentResponse={consentCookie !== undefined}
				>
					<NextIntlClientProvider locale={locale} messages={messages}>
						<ClientProviders>
							<ThemeProvider
								attribute="class"
								disableTransitionOnChange
								enableSystem={false}
								defaultTheme={config.defaultTheme}
								forcedTheme={config.defaultTheme}
								themes={Array.from(config.enabledThemes)}
							>
								<NavBar />

								<main className="min-h-screen">{children}</main>

								<Footer />

								<AnalyticsScript />
								<Toaster position="top-right" />
							</ThemeProvider>
						</ClientProviders>
					</NextIntlClientProvider>
				</ConsentProvider>
			</body>
		</html>
	);
}
