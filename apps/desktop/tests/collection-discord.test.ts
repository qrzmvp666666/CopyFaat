import { describe, expect, it, vi } from "vitest";

import {
	collectUnreadDiscordChannels,
	scrollUnreadChannelsToBottom,
} from "../src/main/collection/discord";
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
			resolveMessageRegion: vi.fn(),
			observe: () => snapshot,
			act: vi.fn(),
			scroll,
			wheel: vi.fn(),
			close: vi.fn(),
		};

		const progress = vi.fn();
		const resolveChannelHighlight = vi.fn(() => {
			throw new Error("row has no bounds");
		});
		const result = await collectUnreadDiscordChannels(
			{ ...adapter, resolveChannelHighlight },
			task,
			undefined,
			progress,
		);
		expect(progress.mock.calls.map(([channel]) => [channel.channelId, channel.status])).toEqual(
			channels.flatMap((channel) => [
				[channel.id, "locating"],
				[channel.id, "skipped-read"],
			]),
		);
		expect(progress.mock.calls.every(([channel]) => channel.bounds === undefined)).toBe(true);

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

describe("Discord post-delivery scrolling", () => {
	it.each(["updates中的消息", "Messages in updates"])(
		"uses fresh native bounds when %s has no snapshot coordinates",
		async (listName) => {
			const task = {
				source: {
					platform: "discord",
					server: { id: "123", name: "Example" },
					channels: [{ id: "456", name: "updates" }],
				},
			} as Task;
			const snapshot: DesktopSnapshot = {
				complete: true,
				tree: {
					children: [
						{
							role: "navigation",
							name: "Example (server)",
							children: [
								{
									role: "list",
									name: "Channels",
									children: [
										{
											role: "link",
											name: "updates (text channel)",
											ref_id: "@snapshot:e1",
											url: "https://discord.com/channels/123/456",
										},
									],
								},
							],
						},
						{
							role: "list",
							name: listName,
							children: [{ native_id: { value: "chat-messages-456-789" } }],
						},
					],
				},
			};
			const bounds = { x: 400, y: 150, width: 800, height: 600 };
			const adapter = {
				prepare: vi.fn(),
				resolveRegion: () => bounds,
				resolveMessageRegion: vi.fn(() => bounds),
				observe: () => snapshot,
				act: vi.fn(),
				scroll: vi.fn(),
				wheel: vi.fn(),
				close: vi.fn(),
			};
			await scrollUnreadChannelsToBottom(adapter, task, ["456"]);
			expect(adapter.resolveMessageRegion).toHaveBeenCalledWith("updates");
			expect(adapter.wheel).toHaveBeenCalledWith(bounds, -1000);
			adapter.resolveMessageRegion.mockImplementation(() => {
				throw new Error("ambiguous message list");
			});
			adapter.wheel.mockClear();
			await expect(scrollUnreadChannelsToBottom(adapter, task, ["456"])).rejects.toThrow(
				"ambiguous",
			);
			expect(adapter.wheel).not.toHaveBeenCalled();
		},
	);
});
