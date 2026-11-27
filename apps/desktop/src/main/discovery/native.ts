import { spawnSync } from "node:child_process";
import { join } from "node:path";

import koffi from "koffi";

import type { DiscoveryRect } from "../../shared/contracts";
import { activateMacAccessibility } from "./accessibility";
import { assertDiscordFocused } from "./focus";
import { resolveChannelRegion } from "./region";
import type { DesktopSnapshot } from "./tree";

// Keep all pointer ownership and platform calls inside the isolated engine process.
export function createNativeDesktop(directory: string) {
	const library = koffi.load(
		join(
			directory,
			process.platform === "darwin" ? "libagent_desktop_ffi.dylib" : "agent_desktop_ffi.dll",
		),
	);
	const point = koffi.struct("CfPoint", { x: "double", y: "double" });
	const rect = koffi.struct("CfRect", {
		x: "double",
		y: "double",
		width: "double",
		height: "double",
	});
	const windowInfo = koffi.struct("CfWindow", {
		id: "str",
		title: "str",
		app_name: "str",
		pid: "uint32",
		bounds: rect,
		has_bounds: "bool",
		is_focused: "bool",
	});
	const exactWindow = koffi.struct("CfExactWindow", {
		version: "uint32",
		size: "uint32",
		window: windowInfo,
		process_instance: "str",
		accessible: "bool",
	});
	const action = koffi.struct("CfAction", {
		kind: "int32",
		text: "str",
		scroll: koffi.struct({ direction: "int32", amount: "uint32" }),
		key: koffi.struct({ key: "str", modifiers: "void *", modifier_count: "uint32" }),
		drag: koffi.struct({
			from: point,
			to: point,
			duration_ms: "uint64",
			drop_delay_ms: "uint64",
		}),
	});
	const rawNode = koffi.struct("CfNode", {
		content: koffi.struct({
			ref_id: "str",
			role: "str",
			name: "str",
			value: "str",
			description: "str",
			hint: "str",
		}),
		presentation: koffi.struct({
			states: "void *",
			bounds: rect,
			state_count: "uint32",
			has_bounds: "bool",
		}),
		relation: koffi.struct({
			parent_index: "int32",
			child_start: "uint32",
			child_count: "uint32",
		}),
	});
	const rawTree = koffi.struct("CfTree", { nodes: "void *", count: "uint32" });
	const treeOptions = koffi.struct("CfTreeOptions", {
		max_depth: "uint8",
		include_bounds: "bool",
		interactive_only: "bool",
		compact: "bool",
		surface: "int32",
	});
	const getTree = library.func("ad_get_tree_exact", "int", [
		"void *",
		koffi.pointer(exactWindow),
		koffi.pointer(treeOptions),
		koffi.out(koffi.pointer(rawTree)),
	]);
	const freeTree = library.func("ad_free_tree", "void", [koffi.pointer(rawTree)]);

	const initialize = library.func("int ad_init(uint32 major)");
	const create = library.func("void *ad_adapter_create()");
	const destroy = library.func("void ad_adapter_destroy(void *adapter)");
	const snapshot = library.func(
		"int ad_snapshot(void *adapter, str app, int surface, uint8 depth, bool interactive, bool compact, _Out_ void **out)",
	);
	const execute = library.func("ad_execute_by_ref_timeout", "int", [
		"void *",
		"str",
		koffi.pointer(action),
		"int",
		"int64",
		koffi.out(koffi.pointer("void *")),
	]);
	const freeString = library.func("void ad_free_string(void *value)");
	const listWindows = library.func(
		"int ad_list_windows_exact(void *adapter, str app, bool focused, _Out_ void **out)",
	);
	const windowCount = library.func("uint32 ad_exact_window_list_count(void *list)");
	const windowAt = library.func("void *ad_exact_window_list_get(void *list, uint32 index)");
	const freeWindows = library.func("void ad_exact_window_list_free(void *list)");
	const focus = library.func("ad_focus_window_exact", "int", [
		"void *",
		koffi.pointer(exactWindow),
	]);
	const wheel = library.func("ad_mouse_wheel", "int", [
		"void *",
		point,
		"double",
		"double",
		"uint32",
	]);
	if (
		initialize(7) !== 0 ||
		koffi.sizeof(action) !== Number(library.func("size_t ad_action_size()")()) ||
		koffi.sizeof(exactWindow) !== Number(library.func("size_t ad_exact_window_info_size()")())
	)
		throw new Error("桌面引擎版本不兼容，请重新安装 CopyFast。");
	const adapter = create();
	if (!adapter) throw new Error("桌面引擎初始化失败。");
	let identity = "";
	let windowId = "";

	function pinnedWindow(activate = false) {
		const output: unknown[] = [null];
		const result = listWindows(adapter, "Discord", false, output);
		try {
			if (result !== 0 || !output[0])
				throw new Error("无法读取 Discord 窗口，请检查辅助功能权限。");
			const count = windowCount(output[0]);
			if (count === 0)
				throw new Error("未找到可访问的 Discord 窗口，请打开桌面端及目标服务器后重试。");
			const windows = Array.from(
				{ length: count },
				(_, index) =>
					koffi.decode(windowAt(output[0], index), exactWindow) as {
						window: {
							id: string;
							title: string;
							pid: number;
							bounds: DiscoveryRect;
							has_bounds: boolean;
							is_focused: boolean;
						};
						process_instance: string;
						accessible: boolean;
					},
			);
			const primaryWindows = windows.filter(
				(value) =>
					value.window.has_bounds &&
					value.window.bounds.width >= 300 &&
					value.window.bounds.height >= 200,
			);
			if (primaryWindows.length > 1)
				throw new Error("请只保留一个 Discord 主窗口，打开目标服务器后重试。");
			const value = primaryWindows[0];
			if (!value) throw new Error("未找到 Discord 主窗口，请打开桌面端及目标服务器后重试。");
			const current = `${value.window.id}:${value.window.pid}:${value.process_instance}`;
			if (identity && identity !== current)
				throw new Error("Discord 窗口已变化，请重新选择采集范围。");
			if (!value.accessible || !value.window.has_bounds)
				throw new Error("无法读取 Discord 窗口，请检查辅助功能权限并打开目标服务器。");
			identity = current;
			windowId = value.window.id;
			if (activate && !value.window.is_focused && focus(adapter, value) !== 0)
				throw new Error("无法切换到 Discord 窗口。");
			return value;
		} finally {
			if (output[0]) freeWindows(output[0]);
		}
	}
	function readOutput<T>(call: (out: unknown[]) => number): T {
		const output: unknown[] = [null];
		try {
			const result = call(output);
			if (!output[0]) throw new Error("无法读取 Discord 界面，请检查桌面操作权限。");
			const envelope = JSON.parse(koffi.decode(output[0], "char", -1) as string) as {
				ok: boolean;
				data: T;
			};
			if (result !== 0 || !envelope.ok)
				throw new Error("Discord 界面操作未完成，请重新选择。配置已保留。");
			return envelope.data;
		} finally {
			if (output[0]) freeString(output[0]);
		}
	}
	function locateChannelRegion() {
		const window = pinnedWindow();
		const tree: { nodes: unknown; count: number } = { nodes: null, count: 0 };
		try {
			if (
				getTree(
					adapter,
					window,
					{
						max_depth: 50,
						include_bounds: true,
						interactive_only: false,
						compact: false,
						surface: 0,
					},
					tree,
				) !== 0 ||
				!tree.nodes ||
				tree.count > 100000
			)
				throw new Error("无法读取频道侧栏位置，请确认 Discord 已打开目标服务器。");
			const all = koffi.decode(tree.nodes, rawNode, tree.count) as {
				content: { role: string; name: string };
				presentation: { bounds: DiscoveryRect; has_bounds: boolean };
			}[];
			return resolveChannelRegion(window.window.bounds, window.window.bounds, all);
		} finally {
			freeTree(tree);
		}
	}
	return {
		prepare() {
			if (process.platform === "darwin") {
				const activation = spawnSync(
					"/usr/bin/osascript",
					["-e", 'tell application id "com.hnc.Discord" to activate'],
					{ timeout: 5000, stdio: "ignore" },
				);
				if (activation.error || activation.status !== 0)
					throw new Error("无法切换到 Discord，请确认应用仍在运行并允许桌面控制。");
			}
			const window = pinnedWindow(true).window;
			activateMacAccessibility(window.pid);
			return window.bounds;
		},
		resolveRegion: locateChannelRegion,
		observe() {
			// Channel navigation mutates the AX tree while Discord loads its message pane.
			// Retry bounded reads, retaining only a complete snapshot of the pinned window.
			for (let attempt = 0; attempt < 4; attempt++) {
				pinnedWindow();
				const data = readOutput<DesktopSnapshot>((out) =>
					snapshot(adapter, "Discord", 0, 50, false, false, out),
				);
				if (data.window?.id !== windowId)
					throw new Error("Discord 窗口已变化，请重新开始识别。");
				if (data.complete) return data;
				if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
			}
			throw new Error("Discord 界面持续读取不完整，请等待频道加载完成后重试。");
		},
		act(ref: string, kind: number, direction = 1) {
			assertDiscordFocused(pinnedWindow().window.is_focused);
			if (!/^@[^:]+:e\d+$/.test(ref)) throw new Error("频道定位已失效，请重新扫描。");
			readOutput((out) =>
				execute(
					adapter,
					ref,
					{
						kind,
						text: null,
						scroll: { direction, amount: 6 },
						key: { key: null, modifiers: null, modifier_count: 0 },
						drag: {
							from: { x: 0, y: 0 },
							to: { x: 0, y: 0 },
							duration_ms: 0,
							drop_delay_ms: 0,
						},
					},
					0,
					0,
					out,
				),
			);
		},
		wheel(bounds: DiscoveryRect, deltaY: number) {
			const current = pinnedWindow().window;
			assertDiscordFocused(current.is_focused);
			const x = bounds.x + bounds.width * 0.65;
			const y = bounds.y + bounds.height * 0.8;
			if (wheel(adapter, { x, y }, 0, deltaY, 0) !== 0)
				throw new Error("无法滚动 Discord 消息列表。");
		},
		scroll(_region: DiscoveryRect, direction: "up" | "down") {
			const current = pinnedWindow().window;
			assertDiscordFocused(current.is_focused);
			// AX can report transient bounds while Discord is being activated. Re-read
			// the sidebar before every coordinate action instead of using cached bounds.
			const region = locateChannelRegion();
			if (
				wheel(
					adapter,
					{ x: region.x + region.width / 2, y: region.y + region.height * 0.7 },
					0,
					direction === "up" ? 10 : -6,
					0,
				) !== 0
			)
				throw new Error("无法滚动频道列表，请重新选择范围。");
		},
		close() {
			destroy(adapter);
		},
	};
}
