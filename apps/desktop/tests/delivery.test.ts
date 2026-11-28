import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

describe("Webhook attachment upload", () => {
	it("uploads real image and video bytes, retains rate-limited files, and clears only confirmed uploads", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-delivery-media-"));
		try {
			const withMedia: Message = {
				...message,
				attachments: [
					{
						url: "https://cdn.discordapp.com/attachments/123/456/chart.jpg",
						name: "chart.jpg",
						kind: "image",
					},
					{
						url: "https://cdn.discordapp.com/attachments/123/789/clip.mp4",
						name: "clip.mp4",
						kind: "file",
					},
				],
			};
			let uploads = 0;
			const downloads = vi.fn();
			const request: typeof fetch = async (input, init) => {
				const address = input instanceof Request ? input.url : input.toString();
				if (address.includes("/attachments/")) {
					downloads();
					return new Response(new Uint8Array([1, 2, 3, 4]), {
						headers: {
							"content-type": address.endsWith("mp4") ? "video/mp4" : "image/jpeg",
						},
					});
				}
				expect(init?.body).toBeInstanceOf(FormData);
				const form = init!.body as FormData;
				const payload = JSON.parse(form.get("payload_json") as string);
				expect(payload.attachments).toEqual([
					{ id: 0, filename: "chart.jpg" },
					{ id: 1, filename: "clip.mp4" },
				]);
				for (const index of [0, 1])
					expect(
						Array.from(
							new Uint8Array(
								await (form.get(`files[${index}]`) as Blob).arrayBuffer(),
							),
						),
					).toEqual([1, 2, 3, 4]);
				return ++uploads === 1
					? new Response("{}", { status: 429 })
					: new Response("{}", { status: 200 });
			};
			expect(
				(await deliverMessage(task, withMedia, new AbortController().signal, request, root))
					.status,
			).toBe("retry");
			expect(await readdir(root)).toHaveLength(4);
			expect(
				(await deliverMessage(task, withMedia, new AbortController().signal, request, root))
					.status,
			).toBe("sent");
			expect(downloads).toHaveBeenCalledTimes(2);
			expect(await readdir(root)).toEqual([]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("never posts a partial message when attachment discovery failed", async () => {
		const request = vi.fn();
		expect(
			(
				await deliverMessage(
					task,
					{ ...message, mediaError: "附件采集未完成" },
					new AbortController().signal,
					request,
				)
			).status,
		).toBe("failed");
		expect(request).not.toHaveBeenCalled();
	});
});
