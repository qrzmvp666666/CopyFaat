import type { MarketingConfig } from "./types";

export const config = {
	appName: "SignalFast",
	docsUrl: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,
	saasUrl: process.env.NEXT_PUBLIC_SAAS_URL as string | undefined,
	xianyuRedeemUrl:
		process.env.NEXT_PUBLIC_XIANYU_REDEEM_URL ??
		"https://www.goofish.com/search?q=SignalFast%20%E5%85%91%E6%8D%A2%E7%A0%81",
	enabledThemes: ["dark"],
	defaultTheme: "dark",
} as const satisfies MarketingConfig;
