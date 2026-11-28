import { describe, expect, it } from "vitest";

import {
	assignReceiverChannel,
	setChannelWebhook,
	getReceiverChannel,
	validateReceiverChannel,
	buildReceiver,
	createReceiverDraft,
	formatFrequency,
	getCollectionStartAt,
	getWebhookHost,
	validateReceiver,
} from "../src/renderer/ui/task-configuration";
import { receiverSchema, taskInputSchema } from "../src/shared/contracts";

const channels = [
	{ id: "announcements", name: "产品公告" },
	{ id: "releases", name: "版本更新" },
];
const destination = {
	key: "news",
	id: "",
	name: "产品资讯",
	webhookUrl: "https://discord.com/api/webhooks/123/synthetic-token-a",
};
const receiver = assignReceiverChannel(
	{ ...createReceiverDraft("discord"), destinations: [destination] },
	channels.map((channel) => channel.id),
	destination.key,
);

describe("new task configuration", () => {
	it("stores addresses on each mapped channel, never globally", () => {
		const result = buildReceiver(receiver, channels);
		expect(result.channels).toHaveLength(2);
		expect(
			result.channels.every((channel) => channel.webhookUrl === destination.webhookUrl),
		).toBe(true);
		expect(result).not.toHaveProperty("webhookUrl");
		expect(result).not.toHaveProperty("server");
		expect(buildReceiver(receiver, channels.slice(1)).channels).toHaveLength(1);
	});

	it("requires selected channels and an independent valid Discord webhook", () => {
		expect(validateReceiver(receiver, channels)).toBe("");
		expect(validateReceiver(receiver, [])).toContain("至少勾选");
		for (const webhookUrl of [
			"",
			"invalid",
			"https://example.com/webhook",
			"http://discord.com/api/webhooks/123/token",
			"https://discord.com.evil.test/api/webhooks/123/token",
			"https://discord.com/api/webhooks/123/token?secret=x",
		]) {
			expect(
				validateReceiver(
					{ ...receiver, destinations: [{ ...destination, webhookUrl }] },
					channels,
				),
			).toContain("Discord Webhook");
		}
		expect(validateReceiver({ ...receiver, destinations: [] }, channels)).toContain(
			"填写 Discord Webhook 地址",
		);
	});

	it("rejects duplicate, missing and unrelated mappings at the save boundary", () => {
		const input = {
			name: "产品社区更新",
			source: {
				platform: "discord",
				server: { id: "community", name: "产品社区" },
				channels,
			},
			rules: { intervalSeconds: 60, startAt: new Date(0).toISOString() },
			receiver: buildReceiver(receiver, channels),
		};
		expect(taskInputSchema.safeParse(input).success).toBe(true);
		for (const mappings of [
			input.receiver.channels.slice(1),
			[input.receiver.channels[0], input.receiver.channels[0]],
			[
				{ ...input.receiver.channels[0], sourceChannelId: "other" },
				input.receiver.channels[1],
			],
		]) {
			expect(
				taskInputSchema.safeParse({
					...input,
					receiver: { ...input.receiver, channels: mappings },
				}).success,
			).toBe(false);
		}
	});

	it("formats frequencies and displays only the webhook host in the task preview", () => {
		expect(formatFrequency(30)).toBe("30 秒");
		expect(formatFrequency(60)).toBe("1 分钟");
		expect(formatFrequency(300)).toBe("5 分钟");
		expect(getWebhookHost("https://example.com/secret?token=private")).toBe("example.com");
		expect(getWebhookHost("")).toBe("尚未设置接收地址");
	});
});

describe("receiver channel routing", () => {
	const destinations = [
		{
			key: "signals",
			id: "",
			name: "交易信号",
			webhookUrl: "https://discord.com/api/webhooks/123/synthetic-token-a",
		},
		{
			key: "news",
			id: "",
			name: "行情观察",
			webhookUrl: "https://discord.com/api/webhooks/456/synthetic-token-b",
		},
	];
	const draft = { ...createReceiverDraft("discord"), destinations };

	it("persists distinct per-channel addresses and supports sharing a receiver", () => {
		const shared = assignReceiverChannel(
			draft,
			channels.map((channel) => channel.id),
			"signals",
		);
		expect(validateReceiver(shared, channels)).toBe("");
		expect(
			buildReceiver(shared, channels).channels.map((channel) => channel.webhookUrl),
		).toEqual([destinations[0].webhookUrl, destinations[0].webhookUrl]);
		const split = assignReceiverChannel(shared, [channels[1].id], "news");
		expect(buildReceiver(split, channels).channels[1]).toEqual({
			sourceChannelId: channels[1].id,
			target: { id: "", name: "行情观察" },
			webhookUrl: destinations[1].webhookUrl,
		});
		expect(buildReceiver(split, channels.slice(1)).channels[0].webhookUrl).toBe(
			destinations[1].webhookUrl,
		);
		expect(receiverSchema.safeParse(buildReceiver(split, channels)).success).toBe(true);
	});

	it("requires mappings and follows receiver edits without losing temporarily unchecked mappings", () => {
		expect(validateReceiver(draft, channels)).toContain("填写 Discord Webhook 地址");
		const assigned = assignReceiverChannel(
			draft,
			channels.map((channel) => channel.id),
			"signals",
		);
		const edited = {
			...assigned,
			destinations: [
				{ ...destinations[0], name: "新名称", webhookUrl: destinations[1].webhookUrl },
			],
		};
		expect(getReceiverChannel(edited, channels[0].id)?.name).toBe("新名称");
		expect(buildReceiver(edited, channels.slice(0, 1)).channels).toHaveLength(1);
		expect(buildReceiver(edited, channels).channels[1].webhookUrl).toBe(
			destinations[1].webhookUrl,
		);
		expect(assignReceiverChannel(draft, [channels[0].id], "missing")).toBe(draft);
	});

	it("rejects invalid Discord endpoints and empty receiver names", () => {
		for (const webhookUrl of [
			"https://example.com/webhook",
			"https://discord.com.evil.test/api/webhooks/123/token",
			"http://discord.com/api/webhooks/123/token",
			"https://discord.com/api/webhooks/123/token?x=y",
			"https://discord.com:444/api/webhooks/123/token",
			"https://discord.com/api/webhooks/123",
		])
			expect(validateReceiverChannel({ ...destinations[0], webhookUrl })).toContain(
				"Discord Webhook",
			);
		expect(validateReceiverChannel({ ...destinations[0], name: " " })).toContain(
			"接收频道名称",
		);
		expect(validateReceiverChannel(destinations[0])).toBe("");
	});
});

describe("inline per-source Webhooks", () => {
	it("stores each row independently, including identical URLs and clearing", () => {
		const first = setChannelWebhook(
			createReceiverDraft("discord"),
			channels[0],
			destination.webhookUrl,
		);
		const both = setChannelWebhook(first, channels[1], destination.webhookUrl);
		expect(getReceiverChannel(both, channels[0].id)?.key).not.toBe(
			getReceiverChannel(both, channels[1].id)?.key,
		);
		expect(validateReceiver(both, channels)).toBe("");
		const cleared = setChannelWebhook(both, channels[0], "");
		expect(getReceiverChannel(cleared, channels[1].id)?.webhookUrl).toBe(
			destination.webhookUrl,
		);
		expect(validateReceiver(cleared, channels)).toContain("Discord Webhook");
		expect(buildReceiver(both, channels.slice(1)).channels).toHaveLength(1);
	});
	it("preserves existing shared configs but isolates a row when edited", () => {
		const changed = setChannelWebhook(
			receiver,
			channels[0],
			"https://discord.com/api/webhooks/456/synthetic-token-b",
		);
		expect(getReceiverChannel(changed, channels[1].id)?.webhookUrl).toBe(
			destination.webhookUrl,
		);
		expect(getReceiverChannel(changed, channels[0].id)?.webhookUrl).toContain("/456/");
		expect(getReceiverChannel(receiver, channels[0].id)?.webhookUrl).toBe(
			destination.webhookUrl,
		);
		const again = setChannelWebhook(changed, channels[0], destination.webhookUrl);
		expect(again.destinations).toHaveLength(changed.destinations.length);
	});
});

describe("collection start time", () => {
	it("calculates now, one-hour and one-day ranges from the save time", () => {
		const now = Date.parse("2026-11-28T08:00:00.000Z");
		expect(getCollectionStartAt("new", now)).toBe("2026-11-28T08:00:00.000Z");
		expect(getCollectionStartAt("hour", now)).toBe("2026-11-28T07:00:00.000Z");
		expect(getCollectionStartAt("day", now)).toBe("2026-11-27T08:00:00.000Z");
	});
});
