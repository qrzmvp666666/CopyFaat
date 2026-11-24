import type { MarketingConfig } from "./types";

export const config = {
	appName: "CopyFast",
	docsUrl: process.env.NEXT_PUBLIC_DOCS_URL as string | undefined,
	saasUrl: process.env.NEXT_PUBLIC_SAAS_URL as string | undefined,
	downloadUrls: {
		windows: process.env.NEXT_PUBLIC_COPYFAST_WINDOWS_DOWNLOAD_URL as string | undefined,
		macAppleSilicon: process.env.NEXT_PUBLIC_COPYFAST_MAC_ARM_DOWNLOAD_URL as
			| string
			| undefined,
		macIntel: process.env.NEXT_PUBLIC_COPYFAST_MAC_INTEL_DOWNLOAD_URL as string | undefined,
	},
	enabledThemes: ["dark"],
	defaultTheme: "dark",
} as const satisfies MarketingConfig;
