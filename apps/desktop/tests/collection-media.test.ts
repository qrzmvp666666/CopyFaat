import { describe, expect, it, vi } from "vitest";

import type { DiscordCollectionAdapter } from "../src/main/collection/discord";
import { resolveDiscordMedia } from "../src/main/collection/media";
import type { CollectedMessage, Task } from "../src/shared/contracts";

const task = {
	rules: {
		startAt: new Date(0).toISOString(),
		include: "",
		exclude: "",
		images: true,
		attachments: true,
	},
} as Task;
function message(): CollectedMessage {
	return {
		id: "456",
		channelId: "123",
		text: "",
		author: "Source",
		sentAt: new Date().toISOString(),
		attachments: [],
		mediaLabels: [{ kind: "image", label: "图片" }],
	};
}

function adapter(url = "https://cdn.discordapp.com/attachments/123/789/chart.jpg") {
	let menu = false;
	let generation = 0;
	const clipboard = vi.fn(async (phase: string) => (phase === "read" ? url : undefined));
	const openMediaMenu = vi.fn((id: string, index: number) => {
		expect([id, index]).toEqual(["456", 0]);
		generation++;
		menu = true;
	});
	const desktop = {
		observe: () => ({
			complete: true,
			tree: menu
				? {
						children: [
							{
								role: "menuitem",
								name: "复制图片链接",
								ref_id: `copy-${generation}`,
							},
						],
					}
				: {
						native_id: { value: "message-accessories-456" },
						children: [{ role: "button", name: "图片", ref_id: `image-${generation}` }],
					},
		}),
		openMediaMenu,
		mediaClipboard: clipboard,
		act: vi.fn((ref: string, kind: number) => {
			if (kind === 0) {
				expect(ref).toBe(`copy-${generation}`);
				menu = false;
			}
		}),
	} as unknown as DiscordCollectionAdapter;
	return { desktop, clipboard, openMediaMenu };
}

describe("Source media extraction", () => {
	it("binds a fresh attachment link to its exact source message and restores the clipboard", async () => {
		const { desktop, clipboard } = adapter();
		const [result] = await resolveDiscordMedia(desktop, task, [message()], "123");
		expect(result.mediaError).toBeUndefined();
		expect(result.attachments).toEqual([
			{
				url: "https://cdn.discordapp.com/attachments/123/789/chart.jpg",
				name: "chart.jpg",
				kind: "image",
			},
		]);
		expect(clipboard.mock.calls.map(([phase]) => phase)).toEqual(["begin", "read", "restore"]);
	});

	it("refuses media from another channel instead of silently forwarding it", async () => {
		const { desktop } = adapter("https://cdn.discordapp.com/attachments/999/789/chart.jpg");
		const [result] = await resolveDiscordMedia(desktop, task, [message()], "123");
		expect(result.mediaError).toContain("来源频道");
		expect(result.attachments).toEqual([]);
	});

	it("does not manipulate Discord for messages excluded by the start time", async () => {
		const { desktop, openMediaMenu } = adapter();
		await resolveDiscordMedia(
			desktop,
			{
				...task,
				rules: { ...task.rules, startAt: new Date(Date.now() + 60_000).toISOString() },
			},
			[message()],
			"123",
		);
		expect(openMediaMenu).not.toHaveBeenCalled();
	});
});
