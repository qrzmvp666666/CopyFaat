import { networkInterfaces } from "node:os";

import { withContentCollections } from "@content-collections/next";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");
const localNetworkOrigins = Object.values(networkInterfaces())
	.flatMap((interfaces) => interfaces ?? [])
	.filter((networkInterface) => networkInterface.family === "IPv4")
	.map((networkInterface) => networkInterface.address)
	.filter((address) => address !== "127.0.0.1");

const nextConfig: NextConfig = {
	allowedDevOrigins: ["copyfast.localhost", ...localNetworkOrigins],
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

export default withContentCollections(withNextIntl(nextConfig));
