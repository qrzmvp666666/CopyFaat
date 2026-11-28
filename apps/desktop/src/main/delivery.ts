import type { Message, Task } from "../shared/contracts";
import { cacheMessageMedia, removeCachedMedia, type CachedMediaFile } from "./media-cache";

export interface WebhookDeliveryResult {
	status: "sent" | "retry" | "failed" | "uncertain";
	httpStatus?: number;
	retryAfterMs?: number;
	error?: string;
}

function discordWebhookForMessage(task: Task, message: Message): string | undefined {
	return task.receiver?.channels.find((entry) => entry.sourceChannelId === message.channelId)
		?.webhookUrl;
}

export function webhookPayload(task: Task, message: Message) {
	const channelName = message.channelName ?? message.channelId;
	const title = `${task.source.server.name} / #${channelName}`.slice(0, 256);
	const mediaInfo = message.mediaLabels.map(
		(media) => `[${media.kind === "image" ? "图片" : "附件"}] ${media.label}`,
	);
	const description = [message.text, ...mediaInfo].filter(Boolean).join("\n").slice(0, 4096);
	return {
		embeds: [
			{
				title,
				description: description || "（无文字内容）",
				author: { name: message.author.slice(0, 256) || "未知用户" },
				timestamp: message.sentAt,
			},
		],
		allowed_mentions: { parse: [] as string[] },
	};
}

export async function deliverMessage(
	task: Task,
	message: Message,
	signal: AbortSignal,
	request: typeof fetch = fetch,
	mediaDirectory?: string,
): Promise<WebhookDeliveryResult> {
	const webhookUrl = discordWebhookForMessage(task, message);
	if (!webhookUrl) return { status: "failed", error: "未配置该来源频道的 Discord Webhook。" };
	if (message.mediaLabels.length && !message.attachments.length && !message.mediaError)
		return { status: "failed", error: "仅识别到附件说明，尚未取得原文件；未发送本条消息。" };
	if (message.mediaError) return { status: "failed", error: message.mediaError };
	let files: CachedMediaFile[] = [];
	if (message.attachments.length) {
		if (!mediaDirectory) return { status: "failed", error: "附件缓存未配置，未发送本条消息。" };
		try {
			files = await cacheMessageMedia(mediaDirectory, message, signal, request);
		} catch (error) {
			return {
				status: "retry",
				error: error instanceof Error ? error.message : "附件下载失败，未发送本条消息。",
			};
		}
	}
	const payload = {
		...webhookPayload(task, message),
		...(files.length
			? {
					attachments: files.map((file, index) => ({ id: index, filename: file.name })),
				}
			: {}),
	};
	const multipart = files.length ? new FormData() : undefined;
	if (multipart) {
		multipart.append("payload_json", JSON.stringify(payload));
		files.forEach((file, index) =>
			multipart.append(
				`files[${index}]`,
				new Blob([Buffer.from(file.bytes)], { type: file.contentType }),
				file.name,
			),
		);
	}
	const url = new URL(webhookUrl);
	url.searchParams.set("wait", "true");
	try {
		const response = await request(url, {
			method: "POST",
			redirect: "error",
			headers: multipart ? undefined : { "content-type": "application/json" },
			body: multipart ?? JSON.stringify(payload),
			signal: AbortSignal.any([signal, AbortSignal.timeout(files.length ? 120_000 : 15_000)]),
		});
		if (response.ok) {
			// A confirmed upload remains successful even if local cleanup needs a later retry.
			await removeCachedMedia(files).catch(() => {});
			return { status: "sent", httpStatus: response.status };
		}
		if (response.status === 429) {
			let retryAfterMs = Number(response.headers.get("retry-after")) * 1000;
			try {
				const data = (await response.json()) as { retry_after?: number };
				if (Number.isFinite(data.retry_after)) retryAfterMs = data.retry_after! * 1000;
			} catch {
				// Use the standard Retry-After header when the response body is unavailable.
			}
			return {
				status: "retry",
				httpStatus: response.status,
				retryAfterMs: Math.max(1000, Math.min(retryAfterMs || 5000, 300_000)),
				error: "Discord Webhook 触发频率限制。",
			};
		}
		if (response.status >= 500)
			return {
				status: "uncertain",
				httpStatus: response.status,
				error: `Discord 返回 HTTP ${response.status}，无法确认是否已接收；为避免重复暂不自动重发。`,
			};
		return {
			status: "failed",
			httpStatus: response.status,
			error: `Discord Webhook 返回 HTTP ${response.status}。`,
		};
	} catch (error) {
		return {
			status: "uncertain",
			error:
				error instanceof Error
					? `发送未取得确认（${error.name}），为避免重复暂不自动重发。`
					: "发送未取得确认，为避免重复暂不自动重发。",
		};
	}
}
