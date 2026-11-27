import { createHash } from "node:crypto";

export interface DesktopNode {
	role?: string;
	name?: string;
	value?: string;
	url?: string;
	hint?: string;
	ref_id?: string;
	native_id?: { value?: string };
	states?: string[];
	bounds?: { x: number; y: number; width: number; height: number };
	available_actions?: string[];
	children?: DesktopNode[];
}
export interface DesktopSnapshot {
	complete: boolean;
	window?: { id: string };
	tree: DesktopNode;
}
export interface ChannelEntry {
	name: string;
	category: string;
	ref: string;
	platformId?: string;
	serverId?: string;
	selected: boolean;
	unread: boolean;
	canScrollTo: boolean;
}
export function nodes(root: DesktopNode): DesktopNode[] {
	return [root, ...(root.children ?? []).flatMap(nodes)];
}
export function serverNavigation(data: DesktopSnapshot, expected?: string) {
	const matches = nodes(data.tree).filter(
		(node) =>
			node.role === "navigation" &&
			/(?:\s*\(服务器\)|\s*（服务器）|\s*\(server\))$/i.test(node.name ?? ""),
	);
	if (matches.length !== 1) throw new Error("请先在 Discord 中打开一个服务器，再重新开始选择。");
	const server = matches[0];
	const name = server.name!.replace(/\s*(?:\(服务器\)|（服务器）|\(server\))$/i, "").trim();
	if (expected && name !== expected)
		throw new Error("当前服务器已切换，扫描已停止。请重新开始选择。");
	return { node: server, name };
}
export function channelList(server: DesktopNode) {
	const lists = nodes(server).filter(
		(node) => node.role === "list" && /^(频道|Channels)$/i.test(node.name ?? ""),
	);
	if (lists.length !== 1) throw new Error("无法唯一定位频道列表，请展开服务器频道侧栏。");
	return lists[0];
}
export function channelEntries(list: DesktopNode, previousCategory = ""): ChannelEntry[] {
	let category = previousCategory;
	const entries: ChannelEntry[] = [];
	for (const node of nodes(list)) {
		const unread = /^(?:未读[，,]\s*|Unread[,，]\s*)/i.test(node.name ?? "");
		const label = (node.name ?? "").replace(/^(?:未读[，,]\s*|Unread[,，]\s*)/i, "");
		if (node.role === "button" && /(?:[（(](?:类别|category)[）)])(?:[,，].*)?$/i.test(label))
			category = label.replace(/\s*[（(](?:类别|category)[）)](?:[,，].*)?$/i, "").trim();
		if (node.role !== "link" || !node.ref_id) continue;
		const match = label.match(
			/^(.*?)\s*[（(](?:文字频道|text channel|公告频道|announcement channel|论坛频道|forum channel)[）)](?:\s*[,，].*)?$/i,
		);
		if (!match) continue;
		const link = [node.url, node.value, node.hint, node.native_id?.value].find((value) =>
			/\/channels\/\d+\/\d+/.test(value ?? ""),
		);
		const ids = link?.match(/\/channels\/(\d+)\/(\d+)(?:\/|\?|#|$)/);
		entries.push({
			name: match[1].trim(),
			category,
			ref: node.ref_id,
			selected: node.states?.includes("selected") ?? false,
			unread,
			canScrollTo: node.available_actions?.includes("ScrollTo") ?? false,
			...(ids ? { serverId: ids[1], platformId: ids[2] } : {}),
		});
	}
	const keys = entries.map(entryKey);
	if (new Set(keys).size !== keys.length)
		throw new Error("同一分类存在同名频道，无法安全定位。请调整频道名称后重试。");
	return entries;
}
export function entryKey(entry: Pick<ChannelEntry, "category" | "name">) {
	return JSON.stringify([entry.category, entry.name]);
}
export function localId(server: string, category = "", name = "") {
	return `local:${createHash("sha256")
		.update(JSON.stringify([server, category, name]))
		.digest("hex")
		.slice(0, 32)}`;
}
export function currentChannelId(data: DesktopSnapshot, channelName: string) {
	const lists = nodes(data.tree).filter(
		(node) =>
			node.role === "list" &&
			(node.name === `${channelName}中的消息` || node.name === `Messages in ${channelName}`),
	);
	if (lists.length !== 1) return undefined;
	const ids = new Set(
		nodes(lists[0]).flatMap((node) => {
			const match = node.native_id?.value?.match(/^chat-messages-(\d+)-\d+$/);
			return match ? [match[1]] : [];
		}),
	);
	return ids.size === 1 ? [...ids][0] : undefined;
}
