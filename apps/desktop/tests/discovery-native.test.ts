import { beforeEach, describe, expect, it, vi } from "vitest";

const ffi = vi.hoisted(() => ({
	window: {
		id: "discord-window",
		title: "Discord",
		pid: 42,
		bounds: { x: 15, y: 481, width: 1000, height: 700 },
		has_bounds: true,
		is_focused: true,
	},
	wheel: vi.fn(() => 0),
	windowList: [] as unknown[],
	emptyWindowReads: 0,
	helperOnlyReads: 0,
	pendingAccessibilityReads: 0,
	operationOrder: [] as string[],
	accessibilityCalls: 0,
	snapshots: [] as { complete: boolean; window: { id: string }; tree: { role: string } }[],
	reads: 0,
	messageLists: [] as {
		content: { role: string; name: string };
		presentation: {
			has_bounds: boolean;
			bounds: { x: number; y: number; width: number; height: number };
		};
	}[],
}));
vi.mock("../src/main/discovery/accessibility", () => ({
	activateMacAccessibility: vi.fn(() => {
		ffi.operationOrder.push("enable-ax");
		ffi.accessibilityCalls++;
		if (ffi.pendingAccessibilityReads === 0)
			for (const window of ffi.windowList as { accessible: boolean }[])
				window.accessible = true;
	}),
}));
vi.mock("node:child_process", () => ({
	spawnSync: () => {
		ffi.operationOrder.push("activate");
		return { error: undefined, status: 0 };
	},
}));
vi.mock("koffi", () => ({
	default: {
		struct: (value: unknown) => value,
		pointer: (value: unknown) => value,
		out: (value: unknown) => value,
		sizeof: () => 0,
		decode: (value: unknown) => value,
		load: () => ({
			func: (signature: string) => {
				const name = signature.match(/\b(ad_\w+)/)![1];
				switch (name) {
					case "ad_adapter_create":
						return () => ({});
					case "ad_list_windows_exact":
						return (
							_adapter: unknown,
							_app: string,
							_focused: boolean,
							out: unknown[],
						) => {
							ffi.operationOrder.push("list");
							out[0] = {};
							return 0;
						};
					case "ad_exact_window_list_count":
						return () => {
							if (ffi.emptyWindowReads > 0) {
								ffi.emptyWindowReads--;
								return 0;
							}
							return ffi.windowList.length || 1;
						};
					case "ad_exact_window_list_get":
						return (_list: unknown, index: number) => {
							if (ffi.helperOnlyReads > 0) {
								ffi.helperOnlyReads--;
								return {
									window: {
										...ffi.window,
										id: "helper",
										bounds: { x: 0, y: 0, width: 66, height: 20 },
									},
									process_instance: "instance",
									accessible: true,
								};
							}
							const window = ffi.windowList[index] ?? {
								window: ffi.window,
								process_instance: "instance",
								accessible: true,
							};
							if (ffi.pendingAccessibilityReads > 0) {
								ffi.pendingAccessibilityReads--;
								if (ffi.pendingAccessibilityReads === 0)
									for (const item of ffi.windowList as { accessible: boolean }[])
										item.accessible = true;
							}
							return window;
						};
					case "ad_get_tree_exact":
						return (
							_adapter: unknown,
							_window: unknown,
							_options: unknown,
							out: { nodes: unknown; count: number },
						) => {
							out.nodes = [
								{
									content: { role: "list", name: "频道" },
									presentation: {
										has_bounds: true,
										bounds: {
											x: ffi.window.bounds.x + 72,
											y: ffi.window.bounds.y + 83,
											width: 294,
											height: 700,
										},
									},
								},
							];
							out.nodes = [...(out.nodes as unknown[]), ...ffi.messageLists];
							out.count = (out.nodes as unknown[]).length;
							return 0;
						};
					case "ad_snapshot":
						return (
							_adapter: unknown,
							_app: string,
							_surface: number,
							_depth: number,
							_interactive: boolean,
							_compact: boolean,
							out: unknown[],
						) => {
							ffi.reads++;
							out[0] = JSON.stringify({ ok: true, data: ffi.snapshots.shift() });
							return 0;
						};
					case "ad_mouse_wheel":
						return ffi.wheel;
					default:
						return () => 0;
				}
			},
		}),
	},
}));

import { createNativeDesktop } from "../src/main/discovery/native";

beforeEach(() => {
	ffi.window.id = "discord-window";
	ffi.window.bounds = { x: 15, y: 481, width: 1000, height: 700 };
	ffi.windowList = [];
	ffi.emptyWindowReads = 0;
	ffi.helperOnlyReads = 0;
	ffi.pendingAccessibilityReads = 0;
	ffi.operationOrder = [];
	ffi.accessibilityCalls = 0;
	ffi.wheel.mockClear();
	ffi.snapshots = [];
	ffi.reads = 0;
	ffi.messageLists = [];
});

describe("native discovery window geometry", () => {
	it("activates Discord before enumerating and ignores its tiny helper window", () => {
		ffi.windowList = [
			{
				window: {
					...ffi.window,
					id: "discord-helper",
					bounds: { x: 80, y: 45, width: 66, height: 20 },
				},
				process_instance: "instance",
				accessible: true,
			},
			{
				window: ffi.window,
				process_instance: "instance",
				accessible: true,
			},
		];
		const desktop = createNativeDesktop("/engine");
		expect(desktop.prepare()).toEqual(ffi.window.bounds);
		expect(ffi.operationOrder.slice(0, 4)).toEqual(["activate", "list", "enable-ax", "list"]);
		desktop.close();
	});

	it("enables Discord accessibility and refreshes a stale inaccessible window", () => {
		ffi.windowList = [
			{
				window: ffi.window,
				process_instance: "instance",
				accessible: false,
			},
		];
		const desktop = createNativeDesktop("/engine");
		expect(desktop.prepare()).toEqual(ffi.window.bounds);
		expect(ffi.accessibilityCalls).toBe(1);
		expect(ffi.operationOrder.slice(-2)).toEqual(["enable-ax", "list"]);
		desktop.close();
	});

	it("waits for Discord to initialize its accessibility tree after activation", () => {
		ffi.windowList = [
			{
				window: ffi.window,
				process_instance: "instance",
				accessible: false,
			},
		];
		ffi.pendingAccessibilityReads = 3;
		const desktop = createNativeDesktop("/engine");
		expect(desktop.prepare()).toEqual(ffi.window.bounds);
		expect(ffi.accessibilityCalls).toBe(1);
		desktop.close();
	});

	it("retries briefly while Discord is registering its main window", () => {
		ffi.emptyWindowReads = 3;
		const desktop = createNativeDesktop("/engine");
		expect(desktop.prepare()).toEqual(ffi.window.bounds);
		expect(ffi.emptyWindowReads).toBe(0);
		desktop.close();
	});

	it("waits for the main window when only a helper window is initially listed", () => {
		ffi.helperOnlyReads = 3;
		const desktop = createNativeDesktop("/engine");
		expect(desktop.prepare()).toEqual(ffi.window.bounds);
		expect(ffi.helperOnlyReads).toBe(0);
		desktop.close();
	});

	it("resolves the settled window and refreshes sidebar coordinates before scrolling", () => {
		const desktop = createNativeDesktop("/engine");
		desktop.prepare();
		ffi.window.bounds = { x: 112, y: 48, width: 1748, height: 1032 };
		const sidebar = desktop.resolveRegion();
		expect(sidebar).toEqual({ x: 184, y: 131, width: 294, height: 700 });
		ffi.window.bounds = { x: 312, y: 148, width: 1748, height: 1032 };
		desktop.scroll(sidebar, "down");
		expect(ffi.wheel).toHaveBeenCalledWith(expect.anything(), { x: 531, y: 721 }, 0, -6, 0);
		desktop.close();
	});

	it("still rejects a replacement Discord window before scrolling", () => {
		const desktop = createNativeDesktop("/engine");
		desktop.prepare();
		ffi.window.id = "replacement-window";
		expect(() => desktop.scroll({ x: 0, y: 0, width: 100, height: 100 }, "down")).toThrow(
			"窗口已变化",
		);
		expect(ffi.wheel).not.toHaveBeenCalled();
		desktop.close();
	});
	it("retries a transient incomplete tree without accepting partial data", () => {
		const desktop = createNativeDesktop("/engine");
		desktop.prepare();
		ffi.snapshots = [false, true].map((complete) => ({
			complete,
			window: { id: ffi.window.id },
			tree: { role: "window" },
		}));
		expect(desktop.observe().complete).toBe(true);
		expect(ffi.reads).toBe(2);
		desktop.close();
	});
	it("stops after bounded retries when the tree remains incomplete", () => {
		const desktop = createNativeDesktop("/engine");
		desktop.prepare();
		ffi.snapshots = Array.from({ length: 4 }, () => ({
			complete: false,
			window: { id: ffi.window.id },
			tree: { role: "window" },
		}));
		expect(() => desktop.observe()).toThrow("持续读取不完整");
		expect(ffi.reads).toBe(4);
		desktop.close();
	});
});

it("reads message bounds through the exact-window FFI independently of snapshots", () => {
	const desktop = createNativeDesktop("/engine");
	desktop.prepare();
	ffi.messageLists = [
		{
			content: { role: "list", name: "Messages in updates" },
			presentation: { has_bounds: true, bounds: { x: 400, y: 500, width: 500, height: 500 } },
		},
	];
	expect(desktop.resolveMessageRegion("updates")).toEqual({
		x: 400,
		y: 500,
		width: 500,
		height: 500,
	});
	expect(ffi.reads).toBe(0);
	ffi.window.id = "replacement-window";
	expect(() => desktop.resolveMessageRegion("updates")).toThrow("窗口已变化");
	expect(ffi.wheel).not.toHaveBeenCalled();
	desktop.close();
});
