import {
	discordWebhookUrlSchema,
	receiverSchema,
	type Platform,
	type Receiver,
	type Scope,
} from "../../shared/contracts";

export interface ChannelTargetDraft {
	id: string;
	name: string;
	receiverChannelKey?: string;
}

export interface ReceiverChannelDraft {
	key: string;
	id: string;
	name: string;
	webhookUrl: string;
}

export interface ReceiverDraft {
	destinations: ReceiverChannelDraft[];
	platform: Platform;
	targets: Record<string, ChannelTargetDraft>;
}

export function createReceiverDraft(platform: Platform): ReceiverDraft {
	return {
		destinations: [],
		platform,
		targets: {},
	};
}

export function buildReceiver(draft: ReceiverDraft, channels: Scope["channels"]): Receiver {
	return {
		platform: "discord",
		channels: channels.map((channel) => {
			const destination = getReceiverChannel(draft, channel.id);
			const target = destination ??
				draft.targets[channel.id] ?? { id: "", name: channel.name };
			return {
				sourceChannelId: channel.id,
				target: { id: target.id, name: target.name },
				webhookUrl: destination?.webhookUrl.trim() ?? "",
			};
		}),
	};
}

export function validateReceiver(draft: ReceiverDraft, channels: Scope["channels"]): string {
	if (channels.length === 0) return "请至少勾选一个采集频道";
	if (channels.some((channel) => !getReceiverChannel(draft, channel.id)))
		return "请为每个已选来源频道填写 Discord Webhook 地址";
	for (const channel of channels) {
		const error = validateReceiverChannel(getReceiverChannel(draft, channel.id)!);
		if (error) return error;
	}
	return receiverSchema.safeParse(buildReceiver(draft, channels)).success
		? ""
		: "请检查每个接收频道的名称与 Discord Webhook 地址";
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

export function getReceiverChannel(
	draft: ReceiverDraft,
	sourceChannelId: string | undefined,
): ReceiverChannelDraft | undefined {
	if (!sourceChannelId) return undefined;
	const key = draft.targets[sourceChannelId]?.receiverChannelKey;
	return draft.destinations.find((channel) => channel.key === key);
}

export function assignReceiverChannel(
	draft: ReceiverDraft,
	sourceChannelIds: string[],
	key: string,
): ReceiverDraft {
	const channel = draft.destinations.find((item) => item.key === key);
	if (!channel) return draft;
	const targets = { ...draft.targets };
	for (const id of sourceChannelIds)
		targets[id] = { id: channel.id, name: channel.name, receiverChannelKey: key };
	return { ...draft, targets };
}

export function validateReceiverChannel(channel: ReceiverChannelDraft): string {
	if (!channel.name.trim() || channel.name.length > 160)
		return "请填写接收频道名称（最多 160 个字符）";
	return discordWebhookUrlSchema.safeParse(channel.webhookUrl.trim()).success
		? ""
		: "请粘贴有效的 Discord Webhook 地址";
}

/** Editing a row must never change another source, even for legacy shared destinations. */
export function setChannelWebhook(
	draft: ReceiverDraft,
	source: Scope["channels"][number],
	webhookUrl: string,
): ReceiverDraft {
	const current = getReceiverChannel(draft, source.id);
	const shared =
		current &&
		Object.entries(draft.targets).some(
			([id, target]) => id !== source.id && target.receiverChannelKey === current.key,
		);
	const key = current && !shared ? current.key : crypto.randomUUID();
	const destination: ReceiverChannelDraft = {
		key,
		id: current?.id ?? "",
		name: current?.name ?? source.name,
		webhookUrl,
	};
	return {
		...draft,
		platform: "discord",
		destinations:
			current && !shared
				? draft.destinations.map((item) => (item.key === key ? destination : item))
				: [...draft.destinations, destination],
		targets: {
			...draft.targets,
			[source.id]: { id: destination.id, name: destination.name, receiverChannelKey: key },
		},
	};
}

export type CollectionStartRange = "new" | "hour" | "day";

export function getCollectionStartAt(range: CollectionStartRange, now = Date.now()): string {
	const lookbackSeconds = range === "day" ? 86400 : range === "hour" ? 3600 : 0;
	return new Date(now - lookbackSeconds * 1000).toISOString();
}
