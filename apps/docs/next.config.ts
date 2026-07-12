import { withSentryConfig } from "@sentry/nextjs";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const config: NextConfig = {
	reactStrictMode: true,
	async rewrites() {
		return [
			{
				source: "/:path*.mdx",
				destination: "/llms.mdx/:path*",
			},
		];
	},
};

export default withSentryConfig(withMDX(config), {
	org: "qrz-mvp",
	project: "signalfast",
	silent: !process.env.CI,
	webpack: {
		treeshake: {
			removeDebugLogging: true,
		},
	},
});
