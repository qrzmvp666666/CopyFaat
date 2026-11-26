import { receiverSchema, type Platform, type Receiver, type Scope } from "../../shared/contracts";

export interface ChannelTargetDraft {
	id: string;
	name: string;
}

export interface ReceiverDraft {
	webhookUrl: string;
	platform: Platform;
	serverName: string;
	serverId: string;
	targets: Record<string, ChannelTargetDraft>;
}

export function createReceiverDraft(platform: Platform): ReceiverDraft {
	return { webhookUrl: "", platform, serverName: "", serverId: "", targets: {} };
}

export function buildReceiver(draft: ReceiverDraft, channels: Scope["channels"]): Receiver {
	return {
		webhookUrl: draft.webhookUrl.trim(),
		platform: draft.platform,
		server: { id: draft.serverId.trim(), name: draft.serverName.trim() },
		channels: channels.map((channel) => ({
			sourceChannelId: channel.id,
			target: draft.targets[channel.id] ?? { id: "", name: channel.name },
		})),
	};
}

export function validateReceiver(draft: ReceiverDraft, channels: Scope["channels"]): string {
	if (channels.length === 0) return "请至少勾选一个采集频道";
	const result = receiverSchema.safeParse(buildReceiver(draft, channels));
	if (result.success) return "";
	const field = result.error.issues[0]?.path[0];
	if (field === "webhookUrl") return "请填写有效的 HTTP 或 HTTPS Webhook 地址";
	if (field === "server")
		return "请填写目标服务器名称（最多 160 个字符），服务器 ID 不得超过 200 个字符";
	return "请填写有效的目标频道名称（最多 160 个字符），频道 ID 不得超过 200 个字符";
}

export function formatFrequency(seconds: number): string {
	return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} 分钟` : `${seconds} 秒`;
}

export function getWebhookHost(value: string): string {
	try {
		return new URL(value).host;
	} catch {
		return "尚未设置接收地址";
	}
}
