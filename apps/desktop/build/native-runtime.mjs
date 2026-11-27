import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const VERSION = "1.3.1";
const DIGESTS = {
	"darwin-arm64": "c7b16a16160f1acce183ef0ef81d58d43dfe8778b8d1bcb7bdbeea6c810687d1",
	"darwin-x64": "4d4de1b71b045324f6b3163373d756dc7a9b038b547585501bf75772029c0f18",
	"win32-arm64": "e5d14c52a3e4647e2ef86ed713bf8d6b3150e7a347267dc6bc1e15c7ab7250ed",
	"win32-x64": "b2578949ca0b3421b8bd014d1015de4232f69d1ac13fca0026191fd471c5f878",
};
const execute = promisify(execFile);

export async function prepareNativeRuntime(platform = process.platform, arch = process.arch) {
	const key = `${platform}-${arch}`;
	if (!DIGESTS[key]) throw new Error(`Unsupported desktop runtime: ${key}`);
	const root = resolve(import.meta.dirname, "../dist/native", key);
	try {
		if ((await readFile(join(root, "runtime-version"), "utf8")) === VERSION) return root;
	} catch {
		/* Download the pinned release on first build. */
	}
	const target = `${arch === "arm64" ? "aarch64" : "x86_64"}-${platform === "darwin" ? "apple-darwin" : "pc-windows-msvc"}`;
	const name = `agent-desktop-ffi-v${VERSION}-${target}`;
	const extension = platform === "darwin" ? "tar.gz" : "zip";
	const temporary = await mkdtemp(join(tmpdir(), "copyfast-native-"));
	try {
		const response = await fetch(
			`https://github.com/vercel-labs/agent-desktop/releases/download/v${VERSION}/${name}.${extension}`,
		);
		if (!response.ok) throw new Error(`Native runtime download failed: ${response.status}`);
		const bytes = Buffer.from(await response.arrayBuffer());
		if (createHash("sha256").update(bytes).digest("hex") !== DIGESTS[key])
			throw new Error("Native runtime checksum mismatch");
		const archive = join(temporary, `runtime.${extension}`);
		await writeFile(archive, bytes);
		if (platform === "darwin") await execute("tar", ["-xzf", archive, "-C", temporary]);
		else if (process.platform === "win32")
			await execute("powershell.exe", [
				"-NoProfile",
				"-Command",
				`Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${temporary.replaceAll("'", "''")}'`,
			]);
		else await execute("unzip", ["-q", archive, "-d", temporary]);
		const unpacked = join(temporary, name);
		for (const line of (await readFile(join(unpacked, "SHA256SUMS"), "utf8"))
			.trim()
			.split("\n")) {
			const [digest, file] = line.trim().split(/\s+/);
			if (!file || file.includes("..") || file.startsWith("/"))
				throw new Error("Invalid native runtime manifest");
			if (
				createHash("sha256")
					.update(await readFile(join(unpacked, file)))
					.digest("hex") !== digest
			)
				throw new Error("Native library checksum mismatch");
		}
		await rm(root, { recursive: true, force: true });
		await mkdir(root, { recursive: true });
		await cp(join(unpacked, "lib"), root, { recursive: true });
		await cp(join(unpacked, "LICENSE"), join(root, "LICENSE.agent-desktop"));
		await writeFile(
			join(root, "NOTICE"),
			`CopyFast uses agent-desktop ${VERSION} (Vercel), licensed under Apache-2.0.\nhttps://github.com/vercel-labs/agent-desktop\n`,
		);
		await writeFile(join(root, "runtime-version"), VERSION);
		return root;
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

// electron-builder invokes this for each destination architecture before signing.
export default async function beforePack(context) {
	const arch =
		typeof context.arch === "string" ? context.arch : { 1: "x64", 3: "arm64" }[context.arch];
	await prepareNativeRuntime(context.electronPlatformName, arch);
}
