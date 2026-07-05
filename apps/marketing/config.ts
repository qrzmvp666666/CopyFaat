import type { MarketingConfig } from "./types";

export const config = {
	appName: "SignalFast",
	docsUrl: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,
	saasUrl: process.env.NEXT_PUBLIC_SAAS_URL as string | undefined,
	enabledThemes: ["dark"],
	defaultTheme: "dark",
} as const satisfies MarketingConfig;
