import { networkInterfaces } from "node:os";

// @ts-expect-error - PrismaPlugin is not typed
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const allowedDevOrigin = process.env.NEXT_PUBLIC_SAAS_URL
	? new URL(process.env.NEXT_PUBLIC_SAAS_URL).hostname
	: undefined;
const localNetworkOrigins = Object.values(networkInterfaces())
	.flatMap((interfaces) => interfaces ?? [])
	.filter(({ address, family, internal }) => {
		if (family !== "IPv4" || internal) {
			return false;
		}

		const [first, second, third] = address.split(".").map(Number);
		return (
			first === 10 ||
			(first === 192 && second === 168) ||
			(first === 172 && second >= 16 && second <= 31) ||
			(first === 169 && second === 254 && third !== undefined)
		);
	})
	.map(({ address }) => address);
const allowedDevOrigins = new Set([
	...(allowedDevOrigin ? [allowedDevOrigin] : []),
	"localhost",
	"signalfast.localhost",
	"10.0.2.2",
	...localNetworkOrigins,
	"*.ngrok-free.dev",
	"*.ngrok-free.app",
]);

const nextConfig: NextConfig = {
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
		"pg",
		"prettier",
	],
	allowedDevOrigins: [...allowedDevOrigins],
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
				source: "/:locale(zh|en)/settings",
				destination: "/:locale/settings/general",
				permanent: true,
			},
			{
				source: "/:locale(zh|en)/:organizationSlug/settings",
				destination: "/:locale/:organizationSlug/settings/general",
				permanent: true,
			},
			{
				source: "/:locale(zh|en)/admin",
				destination: "/:locale/admin/users",
				permanent: true,
			},
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
	async headers() {
		return [
			{
				source: "/sw.js",
				headers: [
					{
						key: "Cache-Control",
						value: "no-cache, no-store, must-revalidate",
					},
				],
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

export default withNextIntl(nextConfig);
