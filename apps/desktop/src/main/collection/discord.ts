import { setTimeout as delay } from "node:timers/promises";

import type { Channel, CollectorResponse, Task } from "../../shared/contracts";
import {
	channelEntries,
	channelList,
	currentChannelId,
	entryKey,
	nodes,
	serverNavigation,
	type ChannelEntry,
	type DesktopNode,
	type DesktopSnapshot,
} from "../discovery/tree";

export interface DiscordCollectionAdapter {
	prepare(): unknown;
	resolveRegion(): { x: number; y: number; width: number; height: number };
	observe(): DesktopSnapshot;
	act(ref: string, kind: number): void;
	scroll(
		region: { x: number; y: number; width: number; height: number },
		direction: "up" | "down",
	): void;
	wheel(bounds: { x: number; y: number; width: number; height: number }, deltaY: number): void;
	close(): void;
}

function checkpoint(signal?: AbortSignal) {
	if (signal?.aborted) throw new Error("采集已暂停；未确认的发送结果会保留为待核对状态。");
}

async function wait(milliseconds: number, signal?: AbortSignal) {
	await delay(milliseconds);
	checkpoint(signal);
}

export interface CollectionChannelResult {
	channelId: string;
	status: "unread" | "skipped_read" | "failed";
	collected: number;
	error?: string;
}

export interface DiscordCollectionResult extends CollectorResponse {
	channels: CollectionChannelResult[];
}

function isUnread(entry: ChannelEntry): boolean {
	return entry.unread;
}

function matchesChannel(entry: ChannelEntry, channel: Channel): boolean {
	if (/^\d+$/.test(channel.id) && entry.platformId) return channel.id === entry.platformId;
	if (channel.locator)
		return (
			channel.locator.channelName === entry.name &&
			channel.locator.category === entry.category
		);
	return channel.name === entry.name;
}

function messageText(root?: DesktopNode): string {
	if (!root) return "";
	if (root.children?.length) return root.children.map(messageText).join("");
	if (["statictext", "link", "button", "image"].includes(root.role ?? ""))
		return root.name || root.value || "";
	return "";
}

function snowflakeTime(id: string): string | undefined {
	try {
		const value = BigInt(id);
		const timestamp = Number(value >> 22n) + 1_420_070_400_000;
		if (Number.isFinite(timestamp) && timestamp > 1_420_070_400_000)
			return new Date(timestamp).toISOString();
	} catch {
		return undefined;
	}
	return undefined;
}

function parseMessageList(
	list: DesktopNode,
	channelId: string,
): DiscordCollectionResult["messages"] {
	const groups = nodes(list).filter((node) =>
		/^chat-messages-\d+-\d+$/.test(node.native_id?.value ?? ""),
	);
	const messages = [];
	for (const group of groups) {
		const [, actualChannelId, messageId] = group.native_id!.value!.match(
			/^chat-messages-(\d+)-(\d+)$/,
		)!;
		if (actualChannelId !== channelId) continue;
		const content = nodes(group).find(
			(node) => node.native_id?.value === `message-content-${messageId}`,
		);
		const author = nodes(group).find(
			(node) => node.native_id?.value === `message-username-${messageId}`,
		);
		const article = nodes(group).find((node) => node.role === "article");
		const accessory = nodes(group).find(
			(node) => node.native_id?.value === `message-accessories-${messageId}`,
		);
		const text = messageText(content).trim();
		const mediaLabels = accessory
			? nodes(accessory)
					.filter(
						(node) =>
							/^(?:图片|图像|image|gif|视频|video|附件|file)(?:$|\s)/i.test(
								node.name ?? "",
							) ||
							(node.role === "image" && Boolean(node.name || node.value)),
					)
					.map((node) => ({
						kind:
							/^(?:图片|图像|image|gif)/i.test(node.name ?? "") ||
							node.role === "image"
								? ("image" as const)
								: ("file" as const),
						label: (node.name || node.value || "媒体附件").slice(0, 300),
					}))
					.filter(
						(item, index, all) =>
							all.findIndex((candidate) => candidate.label === item.label) === index,
					)
			: [];
		if (!text && mediaLabels.length === 0) continue;
		messages.push({
			id: messageId,
			channelId,
			author:
				messageText(author).trim() || (article?.name ?? "").split(" , ")[0] || "未知用户",
			text,
			sentAt: snowflakeTime(messageId) ?? new Date().toISOString(),
			attachments: [],
			mediaLabels,
		});
	}
	return messages.slice(-500);
}

function visibleEntries(snapshot: DesktopSnapshot, expectedServer: string, previousCategory = "") {
	const navigation = serverNavigation(snapshot, expectedServer).node;
	return channelEntries(channelList(navigation), previousCategory);
}

function signature(entries: ChannelEntry[]): string {
	return entries.map((entry) => `${entryKey(entry)}:${entry.unread ? "1" : "0"}`).join("|");
}

async function findChannel(
	adapter: DiscordCollectionAdapter,
	task: Task,
	channel: Channel,
	region: { x: number; y: number; width: number; height: number },
	signal?: AbortSignal,
): Promise<{ snapshot: DesktopSnapshot; entry: ChannelEntry }> {
	let snapshot = adapter.observe();
	const findCurrent = async () => {
		const matches = visibleEntries(snapshot, task.source.server.name).filter((entry) =>
			matchesChannel(entry, channel),
		);
		if (matches.length > 1) throw new Error(`频道“${channel.name}”在当前服务器中不唯一。`);
		if (matches.length !== 1) return undefined;
		let entry = matches[0];
		if (entry.canScrollTo) {
			adapter.act(entry.ref, 13);
			await wait(100, signal);
			snapshot = adapter.observe();
			const visible = visibleEntries(snapshot, task.source.server.name).filter((item) =>
				matchesChannel(item, channel),
			);
			if (visible.length !== 1) throw new Error(`频道“${channel.name}”定位后发生变化。`);
			entry = visible[0];
		}
		return { snapshot, entry };
	};
	const initiallyVisible = await findCurrent();
	if (initiallyVisible) return initiallyVisible;

	let previous = "";
	let repeats = 0;
	for (let page = 0; page < 60; page++) {
		checkpoint(signal);
		const entries = visibleEntries(snapshot, task.source.server.name);
		const current = signature(entries);
		repeats = current === previous ? repeats + 1 : 0;
		if (repeats >= 3) break;
		previous = current;
		adapter.scroll(region, "up");
		await wait(200, signal);
		snapshot = adapter.observe();
	}

	previous = "";
	repeats = 0;
	for (let page = 0; page < 300; page++) {
		checkpoint(signal);
		const entries = visibleEntries(snapshot, task.source.server.name);
		const located = await findCurrent();
		if (located) return located;
		const current = signature(entries);
		repeats = current === previous ? repeats + 1 : 0;
		if (repeats >= 3) break;
		previous = current;
		adapter.scroll(region, "down");
		await wait(200, signal);
		snapshot = adapter.observe();
	}
	throw new Error(`未能在 Discord 当前服务器的可访问频道列表中定位“${channel.name}”。`);
}

async function openAndRead(
	adapter: DiscordCollectionAdapter,
	task: Task,
	channel: Channel,
	entry: ChannelEntry,
	signal?: AbortSignal,
): Promise<DiscordCollectionResult["messages"]> {
	adapter.act(entry.ref, 0);
	const listName = `${channel.name}中的消息`;
	const deadline = Date.now() + 20_000;
	let snapshot: DesktopSnapshot | undefined;
	let list: DesktopNode | undefined;
	let emptyListObservations = 0;
	while (Date.now() < deadline) {
		await wait(250, signal);
		snapshot = adapter.observe();
		serverNavigation(snapshot, task.source.server.name);
		const lists = nodes(snapshot.tree).filter(
			(node) =>
				node.role === "list" &&
				(node.name === listName || node.name === `Messages in ${channel.name}`),
		);
		if (lists.length === 1) {
			const observedChannelId = currentChannelId(snapshot, channel.name);
			if (observedChannelId && /^\d+$/.test(channel.id) && observedChannelId !== channel.id)
				throw new Error(`频道“${channel.name}”的 ID 与已保存的来源不一致。`);
			list = lists[0];
			if (observedChannelId) break;
			const hasLoadedMessages = nodes(list).some((node) =>
				/^chat-messages-\d+-\d+$/.test(node.native_id?.value ?? ""),
			);
			emptyListObservations = hasLoadedMessages ? 0 : emptyListObservations + 1;
			if (emptyListObservations >= 2) break;
		}
	}
	if (!snapshot || !list) throw new Error(`频道“${channel.name}”的消息列表在 20 秒内未就绪。`);
	const observedChannelId = currentChannelId(snapshot, channel.name);
	const hasLoadedMessages = nodes(list).some((node) =>
		/^chat-messages-\d+-\d+$/.test(node.native_id?.value ?? ""),
	);
	if (!observedChannelId && hasLoadedMessages)
		throw new Error(`Discord 未暴露“${channel.name}”的真实频道 ID，暂不能安全采集。`);
	if (!observedChannelId) return [];
	return parseMessageList(list, observedChannelId).map((message) => ({
		...message,
		channelId: channel.id,
	}));
}

export async function collectUnreadDiscordChannels(
	adapter: DiscordCollectionAdapter,
	task: Task,
	signal?: AbortSignal,
): Promise<DiscordCollectionResult> {
	if (task.source.platform !== "discord") throw new Error("当前版本仅支持 Discord 采集。");
	adapter.prepare();
	const initial = adapter.observe();
	const serverName = serverNavigation(initial).name;
	if (serverName !== task.source.server.name)
		throw new Error(
			`当前 Discord 服务器是“${serverName}”，任务来源是“${task.source.server.name}”。`,
		);
	const region = adapter.resolveRegion();
	const response: DiscordCollectionResult = {
		version: 1,
		messages: [],
		channels: [],
	};
	for (const channel of task.source.channels) {
		try {
			checkpoint(signal);
			const { entry } = await findChannel(adapter, task, channel, region, signal);
			if (!isUnread(entry)) {
				response.channels.push({
					channelId: channel.id,
					status: "skipped_read",
					collected: 0,
				});
				continue;
			}
			const messages = await openAndRead(adapter, task, channel, entry, signal);
			response.messages.push(...messages);
			response.channels.push({
				channelId: channel.id,
				status: "unread",
				collected: messages.length,
			});
		} catch (error) {
			if (signal?.aborted) throw error;
			response.channels.push({
				channelId: channel.id,
				status: "failed",
				collected: 0,
				error: error instanceof Error ? error.message : "频道读取失败",
			});
		}
	}
	if (response.messages.length > 500) response.messages = response.messages.slice(-500);
	return response;
}

export async function scrollUnreadChannelsToBottom(
	adapter: DiscordCollectionAdapter,
	task: Task,
	channelIds: string[],
	signal?: AbortSignal,
): Promise<void> {
	if (!channelIds.length) return;
	adapter.prepare();
	const region = adapter.resolveRegion();
	for (const channelId of channelIds) {
		checkpoint(signal);
		const channel = task.source.channels.find((item) => item.id === channelId);
		if (!channel) continue;
		const { entry } = await findChannel(adapter, task, channel, region, signal);
		await openAndRead(adapter, task, channel, entry, signal);
		const snapshot = adapter.observe();
		const lists = nodes(snapshot.tree).filter(
			(node) =>
				node.role === "list" && node.name === `${channel.name}中的消息` && node.bounds,
		);
		if (lists.length !== 1 || !lists[0].bounds)
			throw new Error(`无法安全定位“${channel.name}”的消息列表滚动区域。`);
		adapter.wheel(lists[0].bounds, -1000);
	}
}
