import type { SaasConfig } from "./types";

export const config = {
	appName: "CopyFast",
	docsUrl: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,
	marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL as string | undefined,
	enabledThemes: ["light", "dark"],
	defaultTheme: "dark",
	redirectAfterSignIn: "/settings/billing",
	redirectAfterLogout: "/login",
	enableAiChatbot: false,
} as const satisfies SaasConfig;
