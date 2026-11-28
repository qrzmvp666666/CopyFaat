import { setTimeout as delay } from "node:timers/promises";

import type { CollectedMessage, Task } from "../../shared/contracts";
import { nodes, type DesktopNode } from "../discovery/tree";
import { discordAttachmentUrl, MAX_MEDIA_FILES } from "../media-cache";
import type { DiscordCollectionAdapter } from "./discord";

export function mediaKind(node: DesktopNode): "image" | "file" {
	if (
		/^(?:视频|video|附件|file)(?:$|\s)/i.test(node.name ?? "") ||
		/\.(?:mp4|mov|webm|m4v)(?:$|\?)/i.test(node.name ?? "")
	)
		return "file";
	return /\.(?:png|jpe?g|gif|webp)(?:$|\?)/i.test(node.name ?? "") ||
		/^(?:图片|图像|image|gif)/i.test(node.name ?? "") ||
		node.role === "image" ||
		nodes(node).some((child) => child.role === "image")
		? "image"
		: "file";
}

export function mediaTargets(root: DesktopNode): DesktopNode[] {
	const result: DesktopNode[] = [];
	function visit(node: DesktopNode) {
		const label = node.name ?? "";
		const isMedia =
			/^(?:图片|图像|image|gif|视频|video|附件|file)(?:$|[\s.])/i.test(label) ||
			/\.(?:mp4|mov|webm|m4v|png|jpe?g|gif|webp)(?:$|\?)/i.test(label) ||
			Boolean(node.url && discordAttachmentUrl(node.url));
		if (
			(node.ref_id || ["image", "video"].includes(node.role ?? "")) &&
			["button", "link", "image", "video"].includes(node.role ?? "") &&
			isMedia
		) {
			result.push(node);
			return;
		}
		for (const child of node.children ?? []) visit(child);
	}
	visit(root);
	return result;
}

function accessory(adapter: DiscordCollectionAdapter, messageId: string): DesktopNode {
	const matches = nodes(adapter.observe().tree).filter(
		(node) => node.native_id?.value === `message-accessories-${messageId}`,
	);
	if (matches.length !== 1) throw new Error("附件所属消息已离开当前列表，请重新采集。");
	return matches[0];
}

async function copyMediaLink(
	adapter: DiscordCollectionAdapter,
	target: DesktopNode,
	messageId: string,
	mediaIndex: number,
): Promise<string> {
	const direct = [target.url, target.value, target.name].find(
		(value) => value && discordAttachmentUrl(value),
	);
	if (direct) return direct;
	if (!adapter.mediaClipboard || !target.ref_id)
		throw new Error("当前 Discord 未暴露可下载的附件地址。");
	await adapter.mediaClipboard("begin");
	let menuRef: string | undefined;
	try {
		if (adapter.openMediaMenu) {
			adapter.act(target.ref_id, 13);
			await delay(100);
			adapter.openMediaMenu(messageId, mediaIndex);
		} else adapter.act(target.ref_id, 2);
		for (let attempt = 0; attempt < 8; attempt++) {
			await delay(100);
			const menu = nodes(adapter.observe().tree);
			const copy = menu.filter(
				(node) =>
					node.ref_id &&
					/^(?:复制(?:图片|视频|附件|下载)?链接|Copy (?:Image |Video |Attachment |Download )?Link)$/i.test(
						node.name ?? "",
					),
			);
			menuRef = menu.find((node) => node.ref_id && node.role === "menuitem")?.ref_id;
			if (copy.length === 1) {
				adapter.act(copy[0].ref_id!, 0);
				menuRef = undefined;
				const url = await adapter.mediaClipboard("read");
				if (!url || !discordAttachmentUrl(url))
					throw new Error("Discord 返回的附件链接无效。");
				return url;
			}
		}
		throw new Error("Discord 附件菜单没有可用的原文件链接。");
	} finally {
		try {
			menuRef = nodes(adapter.observe().tree).find(
				(node) => node.ref_id && node.role === "menuitem",
			)?.ref_id;
			if (menuRef) adapter.act(menuRef, 14, 1, "escape");
		} catch {
			/* Preserve the original attachment error. */
		}
		await adapter.mediaClipboard("restore");
	}
}

export async function resolveDiscordMedia(
	adapter: DiscordCollectionAdapter,
	task: Task,
	messages: CollectedMessage[],
	actualChannelId: string,
): Promise<CollectedMessage[]> {
	for (const message of messages) {
		if (
			!message.mediaLabels.length ||
			Date.parse(message.sentAt) < Date.parse(task.rules.startAt)
		)
			continue;
		const text = message.text.toLocaleLowerCase();
		const keywords = (value: string) =>
			value
				.split(/[,，\n]/)
				.map((item) => item.trim().toLocaleLowerCase())
				.filter(Boolean);
		const include = keywords(task.rules.include);
		if (
			(include.length && !include.some((word) => text.includes(word))) ||
			keywords(task.rules.exclude).some((word) => text.includes(word))
		)
			continue;
		try {
			const targets = mediaTargets(accessory(adapter, message.id));
			const enabled = targets
				.map((target, index) => ({ target, index, kind: mediaKind(target) }))
				.filter(({ kind }) =>
					kind === "image" ? task.rules.images : task.rules.attachments,
				);
			if (!enabled.length) {
				if (
					message.mediaLabels.some((item) =>
						item.kind === "image" ? task.rules.images : task.rules.attachments,
					)
				)
					throw new Error("当前 Discord 未暴露附件的可操作节点。");
				continue;
			}
			if (enabled.length > MAX_MEDIA_FILES)
				throw new Error(`单条消息超过 ${MAX_MEDIA_FILES} 个附件。`);
			for (const { index, kind } of enabled) {
				// Every menu invalidates snapshot references; resolve the exact source message again.
				const current = mediaTargets(accessory(adapter, message.id));
				if (current.length !== targets.length)
					throw new Error("消息附件列表发生变化，请重新采集。");
				const url = await copyMediaLink(adapter, current[index], message.id, index);
				const parsed = discordAttachmentUrl(url)!;
				if (parsed.pathname.split("/")[2] !== actualChannelId)
					throw new Error("附件链接的来源频道与当前消息不一致。");
				const name = decodeURIComponent(parsed.pathname.split("/").at(-1)!).slice(0, 250);
				message.attachments.push({
					url,
					name,
					kind: /\.(?:mp4|mov|webm|m4v)$/i.test(name) ? "file" : kind,
				});
			}
		} catch (error) {
			message.mediaError =
				`附件采集未完成：${error instanceof Error ? error.message : "读取失败"}`.slice(
					0,
					1000,
				);
		}
	}
	return messages;
}
