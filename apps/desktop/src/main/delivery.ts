import type { Message, Task } from "../shared/contracts";

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
): Promise<WebhookDeliveryResult> {
	const webhookUrl = discordWebhookForMessage(task, message);
	if (!webhookUrl) return { status: "failed", error: "未配置该来源频道的 Discord Webhook。" };
	const url = new URL(webhookUrl);
	url.searchParams.set("wait", "true");
	try {
		const response = await request(url, {
			method: "POST",
			redirect: "error",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(webhookPayload(task, message)),
			signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
		});
		if (response.ok) return { status: "sent", httpStatus: response.status };
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
