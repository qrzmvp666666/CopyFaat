import { spawnSync } from "node:child_process";
import { join } from "node:path";

import koffi from "koffi";

import type { DiscoveryRect } from "../../shared/contracts";
import { mediaTargets } from "../collection/media";
import { activateMacAccessibility } from "./accessibility";
import { resolveChannelHighlight } from "./channel-highlight";
import { assertDiscordFocused } from "./focus";
import { resolveChannelRegion, resolveMessageRegion } from "./region";
import { nodes, type DesktopNode, type DesktopSnapshot } from "./tree";

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
	const checkPermissions = library.func("int ad_check_permissions(void *adapter)");
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
	const mouseEvent = koffi.struct("CfMediaMouseEvent", {
		kind: "int32",
		point,
		button: "int32",
		click_count: "uint32",
	});
	const clickMouse = library.func("ad_mouse_event", "int", ["void *", koffi.pointer(mouseEvent)]);
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
	if (process.platform === "darwin" && checkPermissions(adapter) !== 0) {
		destroy(adapter);
		throw new Error(
			"CopyFast 当前运行进程没有 macOS 辅助功能权限。请在系统设置 > 隐私与安全性 > 辅助功能中启用 CopyFast，然后完全退出并重新打开应用。",
		);
	}
	let identity = "";
	let windowId = "";
	type ExactWindowValue = {
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
	};

	function pinnedWindow(
		activate = false,
		refreshAfterAccessibility = true,
		allowInaccessible = false,
	): ExactWindowValue {
		const output: unknown[] = [null];
		const result = listWindows(adapter, "Discord", false, output);
		try {
			if (result !== 0 || !output[0])
				throw new Error("无法读取 Discord 窗口列表，请确认 Discord 桌面端正在运行后重试。");
			const count = windowCount(output[0]);
			if (count === 0)
				throw new Error("未找到可访问的 Discord 窗口，请打开桌面端及目标服务器后重试。");
			const windows = Array.from(
				{ length: count },
				(_, index) =>
					koffi.decode(windowAt(output[0], index), exactWindow) as ExactWindowValue,
			) as ExactWindowValue[];
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
			if (activate && process.platform === "darwin") {
				activateMacAccessibility(value.window.pid);
				if (refreshAfterAccessibility) {
					let refreshed: ExactWindowValue | undefined;
					for (let attempt = 0; attempt < 12; attempt++) {
						refreshed = pinnedWindow(false, false, true);
						if (refreshed.accessible) break;
						if (attempt < 11)
							Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
					}
					if (!refreshed?.accessible)
						throw new Error(
							"Discord 窗口已找到，但其无障碍界面在等待后仍未就绪。请确认 CopyFast 的辅助功能权限已开启，并完全退出后重新打开 Discord 再试。",
						);
					if (!refreshed.window.is_focused && focus(adapter, refreshed) !== 0)
						throw new Error("无法切换到 Discord 窗口。");
					return refreshed;
				}
			}
			if ((!value.accessible && !allowInaccessible) || !value.window.has_bounds)
				throw new Error(
					"已找到 Discord 窗口，但暂时无法读取其无障碍界面。请确认 CopyFast 的辅助功能权限；若刚开启权限，请完全退出并重新打开 CopyFast 和 Discord。",
				);
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
	function waitForDiscordWindow(): ExactWindowValue {
		let lastError: Error | undefined;
		for (let attempt = 0; attempt < 20; attempt++) {
			try {
				return pinnedWindow(true);
			} catch (error) {
				if (
					!(error instanceof Error) ||
					(!error.message.includes("未找到可访问的 Discord 窗口") &&
						!error.message.includes("未找到 Discord 主窗口"))
				)
					throw error;
				lastError = error;
				if (attempt < 19) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
			}
		}
		throw (
			lastError ?? new Error("未找到可访问的 Discord 窗口，请打开桌面端及目标服务器后重试。")
		);
	}
	function locateRegion(
		channelName?: string,
		highlightChannel?: { name: string; category: string },
	) {
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
				relation: { parent_index: number };
				presentation: { bounds: DiscoveryRect; has_bounds: boolean };
			}[];
			if (highlightChannel)
				return resolveChannelHighlight(window.window.bounds, all, highlightChannel);
			return channelName === undefined
				? resolveChannelRegion(window.window.bounds, window.window.bounds, all)
				: resolveMessageRegion(window.window.bounds, all, channelName);
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
			return waitForDiscordWindow().window.bounds;
		},
		resolveRegion: () => locateRegion(),
		resolveChannelHighlight: (channel: { name: string; category: string }) =>
			locateRegion(undefined, channel),
		resolveMessageRegion: (channelName: string) => locateRegion(channelName),
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
		openMediaMenu(messageId: string, mediaIndex: number) {
			const current = pinnedWindow().window;
			assertDiscordFocused(current.is_focused);
			const snapshotValue = readOutput<DesktopSnapshot>((out) =>
				snapshot(adapter, "Discord", 0, 50, false, false, out),
			);
			if (!snapshotValue.complete || snapshotValue.window?.id !== windowId)
				throw new Error("附件定位时 Discord 窗口发生变化。");
			const accessory = nodes(snapshotValue.tree).find(
				(node) => node.native_id?.value === `message-accessories-${messageId}`,
			);
			const target = accessory && mediaTargets(accessory)[mediaIndex];
			if (!target) throw new Error("无法定位原消息的附件。");
			function findPath(node: DesktopNode, indices: number[] = []): number[] | undefined {
				if (node === target) return indices;
				for (const [index, child] of (node.children ?? []).entries()) {
					const found = findPath(child, [...indices, index]);
					if (found) return found;
				}
			}
			const path = findPath(snapshotValue.tree);
			const tree: { nodes: unknown; count: number } = { nodes: null, count: 0 };
			try {
				if (
					!path ||
					getTree(
						adapter,
						pinnedWindow(),
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
					throw new Error("无法读取附件位置。");
				const all = koffi.decode(tree.nodes, rawNode, tree.count) as {
					content: { role: string; name: string };
					presentation: { has_bounds: boolean; bounds: DiscoveryRect };
					relation: { child_start: number; child_count: number };
				}[];
				let index = 0;
				let expected = snapshotValue.tree;
				for (const childIndex of path) {
					const raw = all[index];
					if (
						!raw ||
						raw.content.role !== expected.role ||
						(raw.content.name || "") !== (expected.name || "") ||
						childIndex >= raw.relation.child_count
					)
						throw new Error("附件布局发生变化，请重新采集。");
					index = raw.relation.child_start + childIndex;
					expected = expected.children![childIndex];
				}
				const raw = all[index];
				const bounds = raw?.presentation.bounds;
				if (
					!raw?.presentation.has_bounds ||
					raw.content.role !== target.role ||
					raw.content.name !== target.name ||
					!bounds ||
					bounds.width < 5 ||
					bounds.height < 5
				)
					throw new Error("附件不在可见区域，请滚动消息后重试。");
				const x = bounds.x + bounds.width / 2;
				const y = bounds.y + bounds.height / 2;
				if (
					x <= current.bounds.x ||
					y <= current.bounds.y ||
					x >= current.bounds.x + current.bounds.width ||
					y >= current.bounds.y + current.bounds.height
				)
					throw new Error("附件位置不在 Discord 窗口内。");
				if (
					clickMouse(adapter, { kind: 3, point: { x, y }, button: 1, click_count: 1 }) !==
					0
				)
					throw new Error("无法打开附件菜单。");
			} finally {
				freeTree(tree);
			}
		},
		act(ref: string, kind: number, direction = 1, key?: string) {
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
						key: { key: key ?? null, modifiers: null, modifier_count: 0 },
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
			const region = locateRegion();
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
