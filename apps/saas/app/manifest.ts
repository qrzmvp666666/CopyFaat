import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		background_color: "#121212",
		display: "standalone",
		icons: [
			{
				sizes: "192x192",
				src: "/pwa-icon-192.png",
				type: "image/png",
			},
			{
				sizes: "512x512",
				src: "/icon.png",
				type: "image/png",
			},
		],
		name: "SignalFast",
		short_name: "SignalFast",
		start_url: "/signals",
		scope: "/",
		theme_color: "#121212",
	};
}
