import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";

import { build } from "esbuild";
import { createServer } from "vite";

import { prepareDevRuntime } from "./dev-runtime.mjs";
const port = Number(process.env.COPYFAST_DEV_PORT ?? 5173);
import { prepareNativeRuntime } from "./native-runtime.mjs";
await prepareNativeRuntime();
await mkdir("dist/main", { recursive: true });
await mkdir("dist/assets", { recursive: true });
await copyFile("assets/icon.png", "dist/assets/icon.png");
await build({
	entryPoints: {
		"discovery-worker": "src/main/discovery/worker.ts",
		"collection-worker": "src/main/collection/worker.ts",
	},
	bundle: true,
	platform: "node",
	format: "cjs",
	outdir: "dist/main",
	outExtension: { ".js": ".cjs" },
	external: ["electron", "koffi"],
	tsconfig: "tsconfig.json",
});
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
const runtime = await prepareDevRuntime();
const server = await createServer({
	root: "src/renderer",
	server: { port, strictPort: true },
});
await server.listen();
const child = spawn(runtime.executable, runtime.args, {
	stdio: "inherit",
	env: { ...process.env, COPYFAST_DEV: "1", ELECTRON_ENABLE_LOGGING: "1" },
});
child.on("exit", (code) => {
	void server.close();
	process.exit(code ?? 0);
});
