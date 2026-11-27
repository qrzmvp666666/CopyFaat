import { existsSync } from "node:fs";
import { join } from "node:path";

interface EngineRuntimePaths {
	resourcesPath: string;
	mainDirectory: string;
	platform: string;
	arch: string;
}

export function resolveEngineDirectory(
	paths: EngineRuntimePaths,
	fileExists: (path: string) => boolean = existsSync,
): string {
	const filename =
		paths.platform === "darwin" ? "libagent_desktop_ffi.dylib" : "agent_desktop_ffi.dll";
	// Finder can open the signed development .app without the dev runner's environment.
	const candidates = [
		join(paths.resourcesPath, "copyfast-engine"),
		join(paths.mainDirectory, `../native/${paths.platform}-${paths.arch}`),
	];
	const directory = candidates.find((candidate) => fileExists(join(candidate, filename)));
	if (!directory) throw new Error("未找到桌面识别引擎，请重新构建或安装 CopyFast。");
	return directory;
}
