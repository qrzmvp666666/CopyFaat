import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { cp, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const execute = promisify(execFile);

export async function prepareDevRuntime() {
	const projectRoot = resolve(import.meta.dirname, "..");
	const electronPath = require("electron");
	if (process.platform !== "darwin") {
		return { executable: electronPath, args: [projectRoot] };
	}

	await preserveDevState();
	const metadata = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
	const runtimeRoot = join(projectRoot, "dist", "dev");
	const bundle = join(runtimeRoot, "CopyFast.app");
	const executable = join(bundle, "Contents", "MacOS", "CopyFast");
	const bootstrap = `require(${JSON.stringify(join(projectRoot, "dist/main/index.cjs"))});\n`;
	const icon = await readFile(join(projectRoot, "assets/icon.icns"));
	const fingerprint = createHash("sha256")
		.update(await readFile(new URL(import.meta.url)))
		.update(electronPath)
		.update(await readFile(join(dirname(electronPath), "../Info.plist")))
		.update(metadata.version)
		.update(bootstrap)
		.update(icon)
		.update(await readFile(join(projectRoot, "dist/main/index.cjs")))
		.update(await readFile(join(projectRoot, "dist/main/preload.cjs")))
		.update(await readFile(join(projectRoot, "dist/main/discovery-worker.cjs")))
		.update(await readFile(join(projectRoot, "dist/main/collection-worker.cjs")))
		.digest("hex");
	const stamp = join(runtimeRoot, "runtime-fingerprint");
	try {
		if ((await readFile(stamp, "utf8")) === fingerprint) {
			await execute("/usr/bin/codesign", ["--verify", "--deep", bundle]);
			return { executable, args: [] };
		}
	} catch {
		// Recreate a missing or outdated local application bundle.
	}

	await mkdir(runtimeRoot, { recursive: true });
	await rm(bundle, { recursive: true, force: true });
	await cp(resolve(dirname(electronPath), "../.."), bundle, {
		recursive: true,
		verbatimSymlinks: true,
	});
	await rename(join(bundle, "Contents/MacOS/Electron"), executable);
	const resources = join(bundle, "Contents/Resources");
	await copyFile(join(projectRoot, "assets/icon.icns"), join(resources, "CopyFast.icns"));
	await mkdir(join(resources, "app"), { recursive: true });
	await writeFile(
		join(resources, "app/package.json"),
		JSON.stringify({ name: "CopyFast", version: metadata.version, main: "index.cjs" }),
	);
	await writeFile(join(resources, "app/index.cjs"), bootstrap);
	const properties = {
		CFBundleDisplayName: "CopyFast",
		CFBundleName: "CopyFast",
		CFBundleExecutable: "CopyFast",
		CFBundleIdentifier: metadata.build.appId,
		CFBundleIconFile: "CopyFast.icns",
		CFBundleShortVersionString: metadata.version,
		CFBundleVersion: metadata.version,
	};
	for (const [key, value] of Object.entries(properties)) {
		await execute("/usr/bin/plutil", [
			"-replace",
			key,
			"-string",
			value,
			join(bundle, "Contents/Info.plist"),
		]);
	}
	await execute("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", bundle]);
	await writeFile(stamp, fingerprint);
	return { executable, args: [] };
}

async function preserveDevState() {
	const support = join(homedir(), "Library/Application Support");
	try {
		await readFile(join(support, "Electron/copyfast-state.json"));
		await mkdir(join(support, "CopyFast"), { recursive: true });
		await copyFile(
			join(support, "Electron/copyfast-state.json"),
			join(support, "CopyFast/copyfast-state.json"),
			constants.COPYFILE_EXCL,
		);
	} catch (error) {
		if (error.code !== "ENOENT" && error.code !== "EEXIST") throw error;
	}
}
