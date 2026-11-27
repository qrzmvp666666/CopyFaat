import { setTimeout as delay } from "node:timers/promises";

import { createDiscoveryControl } from "./control";
import { createNativeDesktop } from "./native";
import { scanDiscordChannels } from "./scan";

const port = process.parentPort;
let desktop: ReturnType<typeof createNativeDesktop> | undefined;
let started = false;
const control = createDiscoveryControl(
	() => port.postMessage({ type: "paused" }),
	() => {
		desktop?.prepare();
	},
);
port.on("message", async ({ data }: { data: { type: string } }) => {
	try {
		if (data.type === "pause") {
			control.pause();
			return;
		}
		if (data.type === "resume") {
			control.resume();
			return;
		}
		if (data.type === "prepare" && !desktop) {
			desktop = createNativeDesktop(process.argv[2]);
			port.postMessage({ type: "ready", bounds: desktop.prepare() });
		} else if (data.type === "scan" && desktop && !started) {
			started = true;
			desktop.prepare();
			for (let remaining = 3; remaining > 0; remaining--) {
				await control.checkpoint();
				port.postMessage({
					type: "progress",
					progress: {
						phase: "countdown",
						found: 0,
						message: `${remaining} 秒后开始识别，请保持 Discord 在前台`,
					},
				});
				await delay(1000);
			}
			await control.checkpoint();
			const channelRegion = desktop.resolveRegion();
			const result = await scanDiscordChannels(
				desktop,
				channelRegion,
				(progress) => port.postMessage({ type: "progress", progress }),
				{
					checkpoint: () => control.checkpoint(),
					...(process.env.COPYFAST_DISCOVERY_TEST_LIMIT === "1" ||
					process.env.COPYFAST_DISCOVERY_TEST_LIMIT === "2" ||
					process.env.COPYFAST_DISCOVERY_TEST_LIMIT === "3"
						? { maxChannels: Number(process.env.COPYFAST_DISCOVERY_TEST_LIMIT) }
						: {}),
					onSnapshot: (result) => port.postMessage({ type: "snapshot", result }),
				},
			);
			await control.checkpoint();
			desktop.close();
			desktop = undefined;
			port.postMessage({ type: "result", result });
		}
	} catch (error) {
		desktop?.close();
		desktop = undefined;
		port.postMessage({
			type: "error",
			message: error instanceof Error ? error.message : "频道识别失败，请重试。",
		});
	}
});
