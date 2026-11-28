import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { clipboard, ClipboardItem } from "electron";

import { discordAttachmentUrl } from "./media-cache";

// This lease is used only by the isolated Discord collector, never by renderer IPC.
export function createMediaClipboardLease() {
	let original: Electron.ClipboardItem[] | undefined;
	let marker = "";
	let copied = "";
	async function restore() {
		if (!original) return;
		const current = await clipboard.readText();
		if (current === marker || (copied && current === copied)) {
			if (original.length) await clipboard.write(original);
			else clipboard.clear();
		}
		original = undefined;
	}
	return {
		restore,
		async request(phase: "begin" | "read" | "restore"): Promise<string | undefined> {
			if (phase === "restore") {
				await restore();
				return;
			}
			if (phase === "begin") {
				if (original) throw new Error("附件剪贴板操作尚未结束。");
				original = await Promise.all(
					(await clipboard.read()).map(
						async (item) =>
							new ClipboardItem(
								Object.fromEntries(
									await Promise.all(
										item.types.map(async (type) => [
											type,
											await item.getType(type),
										]),
									),
								),
							),
					),
				);
				marker = `copyfast-media:${randomUUID()}`;
				copied = "";
				await clipboard.writeText(marker);
				return;
			}
			if (!original) throw new Error("附件剪贴板操作尚未开始。");
			for (let attempt = 0; attempt < 30 && original; attempt++) {
				const value = (await clipboard.readText()).trim();
				if (discordAttachmentUrl(value)) {
					copied = value;
					return value;
				}
				await delay(50);
			}
			throw new Error("Discord 未复制出有效的原文件链接。");
		},
	};
}
