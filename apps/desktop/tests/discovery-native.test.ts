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
	operationOrder: [] as string[],
	snapshots: [] as { complete: boolean; window: { id: string }; tree: { role: string } }[],
	reads: 0,
}));
vi.mock("../src/main/discovery/accessibility", () => ({ activateMacAccessibility: vi.fn() }));
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
						return () => ffi.windowList.length || 1;
					case "ad_exact_window_list_get":
						return (_list: unknown, index: number) =>
							ffi.windowList[index] ?? {
								window: ffi.window,
								process_instance: "instance",
								accessible: true,
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
							out.count = 1;
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
	ffi.operationOrder = [];
	ffi.wheel.mockClear();
	ffi.snapshots = [];
	ffi.reads = 0;
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
		expect(ffi.operationOrder.slice(0, 2)).toEqual(["activate", "list"]);
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
