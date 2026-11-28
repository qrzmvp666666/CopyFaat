import { randomUUID } from "node:crypto";

import type { Task, TaskChannelProgress } from "../../shared/contracts";
import { createNativeDesktop } from "../discovery/native";
import {
	collectUnreadDiscordChannels,
	scrollUnreadChannelsToBottom,
	type DiscordCollectionAdapter,
} from "./discord";

const port = process.parentPort;
function mediaClipboard(phase: "begin" | "read" | "restore"): Promise<string | undefined> {
	return new Promise((resolve, reject) => {
		const id = randomUUID();
		const timeout = setTimeout(() => {
			port.removeListener("message", onReply);
			reject(new Error("附件链接读取超时。"));
		}, 5000);
		function onReply({
			data,
		}: {
			data: { type?: string; id?: string; url?: string; error?: string };
		}) {
			if (data.type !== "media-clipboard-result" || data.id !== id) return;
			clearTimeout(timeout);
			port.removeListener("message", onReply);
			if (data.error) reject(new Error(data.error));
			else resolve(data.url);
		}
		port.on("message", onReply);
		port.postMessage({ type: "media-clipboard", id, phase });
	});
}
port.on(
	"message",
	async ({
		data,
	}: {
		data: { type?: string; task: Task; operation: "collect" | "finish"; channelIds?: string[] };
	}) => {
		if (data.type === "media-clipboard-result") return;
		let adapter: DiscordCollectionAdapter | undefined;
		try {
			adapter = createNativeDesktop(process.argv[2]) as DiscordCollectionAdapter;
			adapter.mediaClipboard = mediaClipboard;
			const bounds = adapter.prepare() as {
				x: number;
				y: number;
				width: number;
				height: number;
			};
			port.postMessage({ type: "ready", bounds });
			const reportProgress = (channel: TaskChannelProgress) =>
				port.postMessage({ type: "progress", channel });
			if (data.operation === "finish") {
				await scrollUnreadChannelsToBottom(
					adapter,
					data.task,
					data.channelIds ?? [],
					undefined,
					reportProgress,
				);
				port.postMessage({ type: "result" });
				return;
			}
			const result = await collectUnreadDiscordChannels(
				adapter,
				data.task,
				undefined,
				reportProgress,
			);
			port.postMessage({ type: "result", result });
		} catch (error) {
			port.postMessage({
				type: "error",
				message: error instanceof Error ? error.message : "Discord 采集失败。",
			});
		} finally {
			adapter?.close();
		}
	},
);
