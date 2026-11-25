import type { DeliveryResult, Message, Task } from "../shared/contracts";

export async function deliverMessage(
	task: Task,
	message: Message,
	secret: string,
	signal: AbortSignal,
): Promise<DeliveryResult> {
	const url = new URL(task.delivery.endpoint);
	if (
		url.protocol !== "https:" &&
		!(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
	)
		throw new Error("同步目标必须使用 HTTPS");
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	let body: unknown;
	if (task.delivery.kind === "discord-webhook") {
		if (
			!/^(?:canary\.|ptb\.)?discord(?:app)?\.com$/.test(url.hostname) ||
			!url.pathname.startsWith("/api/webhooks/")
		)
			throw new Error("请输入有效的 Discord Webhook 地址");
		url.pathname += `/${secret}`;
		url.searchParams.set("wait", "true");
		body = { content: message.text.slice(0, 2000), allowed_mentions: { parse: [] } };
	} else if (task.delivery.kind === "telegram-bot") {
		if (url.origin !== "https://api.telegram.org") throw new Error("Telegram API 地址无效");
		url.pathname = `/bot${secret}/sendMessage`;
		body = { chat_id: task.delivery.chatId, text: message.text.slice(0, 4096) };
	} else {
		if (!message.signal)
			return { state: "failed", error: "此消息尚无结构化信号，需由采集脚本解析后提交" };
		headers["x-signal-webhook-secret"] = secret;
		body = {
			...message.signal,
			eventId: message.key,
			source: {
				platform: task.source.platform,
				serverName: task.source.server.name,
				channelName: task.source.channels.find((c) => c.id === message.channelId)?.name,
				...(typeof message.signal.source === "object" ? message.signal.source : {}),
			},
		};
	}
	try {
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
			redirect: "error",
		});
		const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
		const remoteLogId = typeof data?.logId === "string" ? data.logId : undefined;
		if (!response.ok)
			return {
				state: response.status >= 500 ? "uncertain" : "failed",
				error: `目标服务返回 HTTP ${response.status}`,
				httpStatus: response.status,
				remoteLogId,
			};
		const confirmed =
			task.delivery.kind === "discord-webhook"
				? typeof data?.id === "string"
				: task.delivery.kind === "telegram-bot"
					? data?.ok === true
					: data?.ok === true;
		return {
			state: confirmed ? "confirmed" : "uncertain",
			error: confirmed ? undefined : "尚未取得明确同步回执，请核对目标后处理",
			httpStatus: response.status,
			remoteLogId,
		};
	} catch {
		return { state: "uncertain", error: "未能取得目标回执，消息可能已送达；已停止自动重发" };
	}
}
