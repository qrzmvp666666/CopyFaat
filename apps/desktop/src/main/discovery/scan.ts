import { setTimeout as delay } from "node:timers/promises";

import type {
	DiscoveryProgress,
	DiscoveryRect,
	DiscoveryResult,
	Scope,
} from "../../shared/contracts";
import { isDiscordFocusLost } from "./focus";
import {
	channelEntries,
	channelList,
	currentChannelId,
	entryKey,
	localId,
	nodes,
	serverNavigation,
	type DesktopSnapshot,
} from "./tree";

export interface DiscoveryAdapter {
	observe(): DesktopSnapshot;
	act(ref: string, kind: number): void;
	scroll(region: DiscoveryRect, direction: "up" | "down"): void;
}

export interface DiscoveryScanControl {
	checkpoint?: () => Promise<void>;
	maxChannels?: number;
	onSnapshot?: (result: DiscoveryResult) => void;
}

export async function scanDiscordChannels(
	adapter: DiscoveryAdapter,
	region: DiscoveryRect,
	progress: (value: DiscoveryProgress) => void,
	control: DiscoveryScanControl = {},
): Promise<DiscoveryResult> {
	let data = adapter.observe();
	if (!data.complete) throw new Error("Discord 界面读取不完整，请重试。");
	const targetWindowId = data.window?.id;
	const serverName = serverNavigation(data).name;
	let category = "";
	let serverId: string | undefined;
	let complete = true;
	let stoppedAtBottom = false;
	let interrupted = false;
	const processed = new Set<string>();
	const channels = new Map<string, Scope["channels"][number]>();
	const maxChannels =
		Number.isInteger(control.maxChannels) && control.maxChannels! > 0
			? control.maxChannels
			: undefined;
	let deadline = Date.now() + 12 * 60_000;
	async function checkpoint() {
		const startedAt = Date.now();
		await control.checkpoint?.();
		deadline += Date.now() - startedAt;
	}

	function read() {
		if (Date.now() > deadline)
			throw new Error("扫描超时，请等待 Discord 加载完成后重试。配置已保留。");
		const next = adapter.observe();
		if (!next.complete || next.window?.id !== targetWindowId)
			throw new Error("Discord 窗口已变化或读取不完整，请重试。");
		serverNavigation(next, serverName);
		return next;
	}
	function entries(snapshot: DesktopSnapshot) {
		return channelEntries(channelList(serverNavigation(snapshot, serverName).node), category);
	}
	function signature(snapshot: DesktopSnapshot) {
		return entries(snapshot).map(entryKey).join("|");
	}
	function publish() {
		const values = [...channels.values()];
		// Do not publish ambiguous IDs as a usable partial result.
		if (new Set(values.map((channel) => channel.id)).size !== values.length) return;
		control.onSnapshot?.({
			scope: {
				platform: "discord",
				server: {
					id: serverId ?? localId(serverName),
					name: serverName,
					identity: serverId ? "discord" : "local",
				},
				channels: values,
			},
			complete: false,
			message: `已中途停止识别，保留 ${values.length} 个已识别频道；尚未遍历的频道未包含在内。`,
		});
	}
	function retain(snapshot: DesktopSnapshot) {
		for (const entry of entries(snapshot)) {
			if (serverId && entry.serverId && serverId !== entry.serverId)
				throw new Error("服务器身份验证失败，请重新扫描。");
			serverId ??= entry.serverId;
			const key = entryKey(entry);
			if (channels.has(key)) continue;
			if (maxChannels && channels.size >= maxChannels) break;
			if (channels.size >= 500) throw new Error("当前服务器超过单次识别上限（500 个频道）。");
			channels.set(key, {
				id: entry.platformId ?? localId(serverName, entry.category, entry.name),
				name: entry.name,
				identity: entry.platformId ? "discord" : "local",
				locator: { serverName, category: entry.category, channelName: entry.name },
			});
		}
		publish();
	}

	try {
		if (!maxChannels) retain(data);
		await checkpoint();
		data = read();
		// Rewind first. Stable repeats are a boundary heuristic, never proof of full coverage.
		let previous = "";
		let repeats = 0;
		for (let page = 0; page < 60; page++) {
			const value = signature(data);
			repeats = value === previous ? repeats + 1 : 0;
			if (repeats >= 3) break;
			previous = value;
			adapter.scroll(region, "up");
			await delay(250);
			await checkpoint();
			data = read();
			if (!maxChannels) retain(data);
			if (page === 59)
				throw new Error("无法定位频道列表顶部，请确认 Discord 频道侧栏可滚动后重试。");
		}
		previous = "";
		repeats = 0;
		if (maxChannels) retain(data);
		for (let page = 0; page < 300; page++) {
			// Expand only positively identified collapsed category buttons, one fresh ref per observation.
			for (let expansion = 0; expansion < 50; expansion++) {
				const collapsed = nodes(channelList(serverNavigation(data, serverName).node)).find(
					(node) =>
						node.role === "button" &&
						/[（(](?:类别|category)[）)]/i.test(node.name ?? "") &&
						node.states?.includes("collapsed") &&
						node.ref_id,
				);
				if (!collapsed) break;
				adapter.act(collapsed.ref_id!, 0);
				await delay(250);
				await checkpoint();
				data = read();
				retain(data);
				if (expansion === 49) throw new Error("频道分类展开未完成，请手动展开后重试。");
			}
			const pageEntries = entries(data);
			retain(data);
			for (const initial of pageEntries) {
				if (maxChannels && processed.size >= maxChannels) break;
				await checkpoint();
				const key = entryKey(initial);
				if (processed.has(key)) continue;
				processed.add(key);
				if (channels.size > 500)
					throw new Error("当前服务器超过单次识别上限（500 个频道）。");
				progress({
					phase: "scanning",
					found: channels.size,
					message: `正在识别频道：${initial.name}`,
				});
				data = read();
				const matches = entries(data).filter((item) => entryKey(item) === key);
				if (matches.length !== 1) {
					complete = false;
					continue;
				}
				let entry = matches[0];
				if (entry.canScrollTo) {
					adapter.act(entry.ref, 13);
					await delay(150);
					await checkpoint();
					data = read();
					const visible = entries(data).filter((item) => entryKey(item) === key);
					if (visible.length !== 1) {
						complete = false;
						continue;
					}
					entry = visible[0];
				}
				let id = entry.platformId;
				serverId ??= entry.serverId;
				if (serverId && entry.serverId && serverId !== entry.serverId)
					throw new Error("服务器身份验证失败，请重新扫描。");
				if (!id) {
					const before = currentChannelId(data, entry.name);
					adapter.act(entry.ref, 0);
					let candidate: string | undefined;
					for (let attempt = 0; attempt < 6; attempt++) {
						await delay(350);
						await checkpoint();
						data = read();
						const observed = currentChannelId(data, entry.name);
						// A stale message pane must never be assigned to the newly clicked channel.
						if (
							observed &&
							observed === candidate &&
							(observed !== before || entry.selected)
						) {
							id = observed;
							break;
						}
						candidate = observed;
					}
				}
				channels.set(key, {
					id: id ?? localId(serverName, entry.category, entry.name),
					name: entry.name,
					identity: id ? "discord" : "local",
					locator: { serverName, category: entry.category, channelName: entry.name },
				});
				publish();
			}
			if (maxChannels && processed.size >= maxChannels) break;
			await checkpoint();
			data = read();
			const value = signature(data);
			repeats = value === previous ? repeats + 1 : 0;
			if (repeats >= 3) {
				stoppedAtBottom = true;
				break;
			}
			previous = value;
			category = entries(data).at(-1)?.category ?? category;
			adapter.scroll(region, "down");
			await delay(300);
			await checkpoint();
			data = read();
			retain(data);
		}
	} catch (error) {
		if (!isDiscordFocusLost(error) || !channels.size) throw error;
		interrupted = true;
		complete = false;
	}

	if (!channels.size)
		throw new Error("未发现可读取的文字频道。请确认已打开服务器且频道侧栏可见。");
	const values = [...channels.values()];
	if (new Set(values.map((channel) => channel.id)).size !== values.length)
		throw new Error("多个频道返回相同 ID，无法确认对应关系。请重试。");
	const localCount = values.filter((channel) => channel.identity === "local").length;
	return {
		scope: {
			platform: "discord",
			server: {
				id: serverId ?? localId(serverName),
				name: serverName,
				identity: serverId ? "discord" : "local",
			},
			channels: values,
		},
		// Virtualized/permission-hidden channels cannot be proven absent from an AX tree.
		complete: false,
		message: `已发现 ${values.length} 个频道，${values.length - localCount} 个已获取真实 ID${localCount ? `，${localCount} 个保留本地定位信息` : ""}。${maxChannels ? `测试模式：最多识别 ${maxChannels} 个频道。` : ""}${interrupted ? "你已切换窗口，已保留本次识别结果；可核对频道或重新识别。" : !complete || !stoppedAtBottom || maxChannels ? "部分区域未完成扫描，请核对或重新选择。" : "已扫描可访问的频道列表；隐藏频道或未加载区域请人工核对。"}`,
	};
}
