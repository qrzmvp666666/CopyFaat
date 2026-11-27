import type { Task } from "../../shared/contracts";
import { createNativeDesktop } from "../discovery/native";
import {
	collectUnreadDiscordChannels,
	scrollUnreadChannelsToBottom,
	type DiscordCollectionAdapter,
} from "./discord";

const port = process.parentPort;
port.on(
	"message",
	async ({
		data,
	}: {
		data: { task: Task; operation: "collect" | "finish"; channelIds?: string[] };
	}) => {
		let adapter: DiscordCollectionAdapter | undefined;
		try {
			adapter = createNativeDesktop(process.argv[2]) as DiscordCollectionAdapter;
			const bounds = adapter.prepare() as {
				x: number;
				y: number;
				width: number;
				height: number;
			};
			port.postMessage({ type: "ready", bounds });
			if (data.operation === "finish") {
				await scrollUnreadChannelsToBottom(adapter, data.task, data.channelIds ?? []);
				port.postMessage({ type: "result" });
				return;
			}
			const result = await collectUnreadDiscordChannels(adapter, data.task);
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
