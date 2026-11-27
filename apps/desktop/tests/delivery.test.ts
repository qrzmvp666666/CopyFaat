import { describe, expect, it, vi } from "vitest";

import { deliverMessage, webhookPayload } from "../src/main/delivery";
import type { Message, Task } from "../src/shared/contracts";

const task: Task = {
	id: "task-1",
	name: "Test",
	status: "running",
	createdAt: new Date(0).toISOString(),
	nextRunAt: new Date(0).toISOString(),
	startPaused: false,
	source: {
		platform: "discord",
		server: { id: "server-1", name: "Source server" },
		channels: [{ id: "source-1", name: "updates" }],
	},
	receiver: {
		platform: "discord",
		channels: [
			{
				sourceChannelId: "source-1",
				target: { id: "", name: "updates" },
				webhookUrl: "https://discord.com/api/webhooks/123/synthetic-token",
			},
		],
	},
	rules: {
		intervalSeconds: 30,
		startAt: new Date(0).toISOString(),
		markRead: false,
		include: "",
		exclude: "",
		maxRetries: 2,
		retrySeconds: 10,
		text: true,
		images: true,
		attachments: true,
	},
};

const message: Message = {
	id: "message-1",
	key: "task-1:source-1:message-1",
	taskId: "task-1",
	batchId: "batch-1",
	collectedAt: new Date(0).toISOString(),
	channelId: "source-1",
	channelName: "updates",
	platform: "discord",
	sourceName: "Source server",
	author: "Ada",
	text: "Hello",
	sentAt: new Date(0).toISOString(),
	attachments: [],
	mediaLabels: [],
	status: "collected",
	attempts: 0,
};

describe("Discord Webhook delivery", () => {
	it("posts only to the mapped channel and suppresses mention parsing", async () => {
		const request = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
			const requestUrl = input instanceof Request ? input.url : String(input);
			expect(requestUrl).toBe(
				"https://discord.com/api/webhooks/123/synthetic-token?wait=true",
			);
			const payload = JSON.parse(init?.body as string);
			expect(payload.allowed_mentions).toEqual({ parse: [] });
			expect(payload.embeds[0].description).toBe("Hello");
			return new Response("{}", { status: 200 });
		});
		const result = await deliverMessage(task, message, new AbortController().signal, request);
		expect(result).toMatchObject({ status: "sent", httpStatus: 200 });
		expect(request).toHaveBeenCalledOnce();
	});

	it("honors Discord rate limits and does not retry ambiguous server failures", async () => {
		const rateLimited = await deliverMessage(
			task,
			message,
			new AbortController().signal,
			async () => new Response(JSON.stringify({ retry_after: 2.5 }), { status: 429 }),
		);
		expect(rateLimited).toMatchObject({ status: "retry", retryAfterMs: 2500 });

		const uncertain = await deliverMessage(
			task,
			message,
			new AbortController().signal,
			async () => new Response("unavailable", { status: 503 }),
		);
		expect(uncertain.status).toBe("uncertain");
	});

	it("returns a payload without allowing untrusted text to trigger mentions", () => {
		expect(webhookPayload(task, { ...message, text: "@everyone" }).allowed_mentions).toEqual({
			parse: [],
		});
		expect(
			webhookPayload(task, {
				...message,
				text: "",
				mediaLabels: [{ kind: "image", label: "chart.png" }],
			}).embeds[0].description,
		).toBe("[图片] chart.png");
	});
});
