import { withContentCollections } from "@content-collections/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const nextConfig: NextConfig = {
	transpilePackages: ["@repo/i18n", "@repo/ui", "@repo/mail", "@repo/logs"],
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "placehold.co",
			},
			{
				protocol: "https",
				hostname: "picsum.photos",
			},
			{
				protocol: "https",
				hostname: "i.pravatar.cc",
			},
		],
	},
};

const withSentry = withSentryConfig(withNextIntl(nextConfig), {
	org: "qrz-mvp",
	project: "signalfast",
	silent: !process.env.CI,
	webpack: {
		treeshake: {
			removeDebugLogging: true,
		},
	},
});

export default withContentCollections(withSentry);
