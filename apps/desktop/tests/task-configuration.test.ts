import { describe, expect, it } from "vitest";

import {
	buildReceiver,
	createReceiverDraft,
	formatFrequency,
	getWebhookHost,
	validateReceiver,
} from "../src/renderer/ui/task-configuration";
import { taskInputSchema } from "../src/shared/contracts";

const channels = [
	{ id: "announcements", name: "产品公告" },
	{ id: "releases", name: "版本更新" },
];
const receiver = {
	...createReceiverDraft("discord"),
	webhookUrl: "https://example.com/webhook",
	serverName: "我的工作室",
	targets: { announcements: { id: "news", name: "产品资讯" } },
};

describe("new task configuration", () => {
	it("keeps mappings for selected channels and defaults target names to their source", () => {
		expect(buildReceiver(receiver, channels).channels).toEqual([
			{ sourceChannelId: "announcements", target: { id: "news", name: "产品资讯" } },
			{ sourceChannelId: "releases", target: { id: "", name: "版本更新" } },
		]);
		expect(buildReceiver(receiver, channels.slice(1)).channels).toEqual([
			{ sourceChannelId: "releases", target: { id: "", name: "版本更新" } },
		]);
	});

	it("requires a selected channel, a valid HTTP address, server and target names", () => {
		expect(validateReceiver(receiver, channels)).toBe("");
		expect(validateReceiver(receiver, [])).toContain("至少勾选");
		for (const webhookUrl of [
			"",
			"invalid",
			"javascript:alert(1)",
			"file:///tmp/test",
			"ftp://example.com",
		]) {
			expect(validateReceiver({ ...receiver, webhookUrl }, channels)).toContain("HTTP");
		}
		expect(validateReceiver({ ...receiver, serverName: " " }, channels)).toContain(
			"服务器名称",
		);
		expect(
			validateReceiver(
				{ ...receiver, targets: { announcements: { id: "", name: " " } } },
				channels,
			),
		).toContain("目标频道名称");
	});

	it("rejects duplicate, missing and unrelated mappings at the save boundary", () => {
		const input = {
			name: "产品社区更新",
			source: {
				platform: "discord",
				server: { id: "community", name: "产品社区" },
				channels,
			},
			collector: { executable: "collector", args: [] },
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
