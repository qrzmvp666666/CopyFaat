import type { SaasConfig } from "./types";

export const config = {
	appName: "SignalFast",
	docsUrl: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,
	marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL as string | undefined,
	xianyuRedeemUrl:
		process.env.NEXT_PUBLIC_XIANYU_REDEEM_URL ??
		"https://www.goofish.com/search?q=SignalFast%20%E5%85%91%E6%8D%A2%E7%A0%81",
	enabledThemes: ["light", "dark"],
	defaultTheme: "dark",
	redirectAfterSignIn: "/",
	redirectAfterLogout: "/login",
	enableAiChatbot: false,
} as const satisfies SaasConfig;
