import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveEngineDirectory } from "../src/main/discovery/runtime";

const paths = {
	resourcesPath: "/project/dist/dev/CopyFast.app/Contents/Resources",
	mainDirectory: "/project/dist/main",
	platform: "darwin",
	arch: "arm64",
};
const development = "/project/dist/native/darwin-arm64";
const packaged = join(paths.resourcesPath, "copyfast-engine");

describe("engine runtime resolution", () => {
	it("finds the development engine when launched directly without a dev environment", () => {
		expect(
			resolveEngineDirectory(
				paths,
				(path) => path === join(development, "libagent_desktop_ffi.dylib"),
			),
		).toBe(development);
	});
	it("prefers installed resources when both locations exist", () => {
		expect(resolveEngineDirectory(paths, () => true)).toBe(packaged);
	});
	it("finds the installed Windows DLL", () => {
		expect(
			resolveEngineDirectory(
				{ ...paths, platform: "win32", arch: "x64" },
				(path) => path === join(packaged, "agent_desktop_ffi.dll"),
			),
		).toBe(packaged);
	});
	it("reports a useful error before starting a worker if the library is missing", () => {
		expect(() => resolveEngineDirectory(paths, () => false)).toThrow("未找到桌面识别引擎");
	});
});
