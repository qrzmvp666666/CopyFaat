import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";

import { build } from "esbuild";
import { createServer } from "vite";
const require = createRequire(import.meta.url);
const port = Number(process.env.COPYFAST_DEV_PORT ?? 5173);
await mkdir("dist/main", { recursive: true });
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
const server = await createServer({
	root: "src/renderer",
	server: { port, strictPort: true },
});
await server.listen();
const child = spawn(require.resolve("electron/cli.js"), ["dist/main/index.cjs"], {
	stdio: "inherit",
	env: { ...process.env, COPYFAST_DEV: "1", ELECTRON_ENABLE_LOGGING: "1" },
});
child.on("exit", (code) => {
	void server.close();
	process.exit(code ?? 0);
});
