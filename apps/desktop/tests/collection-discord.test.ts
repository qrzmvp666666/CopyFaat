import { describe, expect, it, vi } from "vitest";

import { collectUnreadDiscordChannels } from "../src/main/collection/discord";
import type { DesktopSnapshot } from "../src/main/discovery/tree";
import type { Task } from "../src/shared/contracts";

describe("Discord collection channel lookup", () => {
	it("does not scroll when selected channels are already in the current accessibility tree", async () => {
		const channels = ["三马哥合约", "分析师舒琴", "大镖客合约"].map((name, index) => ({
			id: String(100 + index),
			name,
		}));
		const task = {
			id: "task-1",
			name: "test",
			status: "running",
			nextRunAt: new Date().toISOString(),
			createdAt: new Date().toISOString(),
			source: {
				platform: "discord",
				server: { id: "server-1", name: "Example" },
				channels,
			},
			rules: {
				intervalSeconds: 60,
				startAt: new Date().toISOString(),
				markRead: true,
				include: "",
				exclude: "",
				maxRetries: 0,
				retrySeconds: 5,
				text: true,
				images: true,
				attachments: true,
			},
		} as Task;
		const snapshot: DesktopSnapshot = {
			complete: true,
			tree: {
				children: [
					{
						role: "navigation",
						name: "Example (服务器)",
						children: [
							{
								role: "list",
								name: "频道",
								children: channels.map((channel) => ({
									role: "link",
									name: `${channel.name}（文字频道）`,
									ref_id: `channel-${channel.id}`,
									url: `https://discord.com/channels/server/${channel.id}`,
								})),
							},
						],
					},
				],
			},
		};
		const scroll = vi.fn(() => {
			throw new Error("wheel unavailable");
		});
		const adapter = {
			prepare: vi.fn(),
			resolveRegion: () => ({ x: 0, y: 0, width: 300, height: 600 }),
			observe: () => snapshot,
			act: vi.fn(),
			scroll,
			wheel: vi.fn(),
			close: vi.fn(),
		};

		const result = await collectUnreadDiscordChannels(adapter, task);

		expect(scroll).not.toHaveBeenCalled();
		expect(result.channels).toEqual(
			channels.map((channel) => ({
				channelId: channel.id,
				status: "skipped_read",
				collected: 0,
			})),
		);
	});
});
