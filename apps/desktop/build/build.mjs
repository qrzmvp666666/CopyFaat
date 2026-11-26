import { copyFile, mkdir } from "node:fs/promises";

import { build } from "esbuild";
await mkdir("dist/main", { recursive: true });
await mkdir("dist/assets", { recursive: true });
await copyFile("assets/icon.png", "dist/assets/icon.png");
await mkdir("dist/renderer", { recursive: true });
await build({
	entryPoints: ["src/main/main.ts"],
	bundle: true,
	platform: "node",
	format: "cjs",
	outfile: "dist/main/index.cjs",
	external: ["electron"],
	sourcemap: true,
	tsconfig: "tsconfig.json",
});
await build({
	entryPoints: ["src/main/preload.ts"],
	bundle: true,
	platform: "node",
	format: "cjs",
	outfile: "dist/main/preload.cjs",
	external: ["electron"],
	sourcemap: true,
	tsconfig: "tsconfig.json",
});
await build({
	entryPoints: ["src/renderer/main.tsx"],
	bundle: true,
	platform: "browser",
	loader: { ".png": "dataurl", ".svg": "dataurl" },
	format: "esm",
	outfile: "dist/renderer/main.js",
	sourcemap: true,
	tsconfig: "tsconfig.json",
});
await copyFile("src/renderer/index.html", "dist/renderer/index.html");
