// @ts-expect-error - PrismaPlugin is not typed
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const allowedDevOrigin = process.env.NEXT_PUBLIC_SAAS_URL
	? new URL(process.env.NEXT_PUBLIC_SAAS_URL).hostname
	: undefined;

const nextConfig: NextConfig = {
	outputFileTracingIncludes: {
		"/*": [
			"./node_modules/packet-reader/**/*",
			"./node_modules/pg/**/*",
			"./node_modules/pg-cloudflare/**/*",
			"./node_modules/pg-connection-string/**/*",
			"./node_modules/pg-int8/**/*",
			"./node_modules/pg-pool/**/*",
			"./node_modules/pg-protocol/**/*",
			"./node_modules/pg-types/**/*",
			"./node_modules/pgpass/**/*",
			"./node_modules/postgres-array/**/*",
			"./node_modules/postgres-bytea/**/*",
			"./node_modules/postgres-date/**/*",
			"./node_modules/postgres-interval/**/*",
			"./node_modules/split2/**/*",
			"./node_modules/xtend/**/*",
		],
	},
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/database",
		"@repo/storage",
		"@repo/ui",
		"@aws-sdk/client-s3",
		"@aws-sdk/s3-request-presigner",
		"@prisma/adapter-pg",
		"@prisma/client",
		"@opentelemetry/instrumentation",
		"import-in-the-middle",
		"prettier",
		"require-in-the-middle",
	],
	allowedDevOrigins: [
		...(allowedDevOrigin ? [allowedDevOrigin] : []),
		"192.168.2.20",
		"192.168.2.20:4100",
		"http://192.168.2.20:4100",
		"https://unwandering-paradisaical-marietta.ngrok-free.dev",
		"*.ngrok-free.dev",
		"*.ngrok-free.app",
	],
	images: {
		remotePatterns: [
			{
				// google profile images
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				// github profile images
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/settings",
				destination: "/settings/general",
				permanent: true,
			},
			{
				source: "/:organizationSlug/settings",
				destination: "/:organizationSlug/settings/general",
				permanent: true,
			},
			{
				source: "/admin",
				destination: "/admin/users",
				permanent: true,
			},
		];
	},
	webpack: (config, { webpack, isServer }) => {
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
			}),
		);

		if (isServer) {
			config.plugins.push(new PrismaPlugin());
		}

		return config;
	},
};

export default withSentryConfig(withNextIntl(nextConfig), {
	org: "qrz-mvp",
	project: "signalfast",
	silent: !process.env.CI,
	webpack: {
		treeshake: {
			removeDebugLogging: true,
		},
	},
});
