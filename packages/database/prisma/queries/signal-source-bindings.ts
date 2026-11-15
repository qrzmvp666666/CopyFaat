import { db } from "../client";

export function normalizeSignalSourceName(value: string) {
	return value
		.normalize("NFKC")
		.replace(/[\u200B-\u200D\uFEFF]/gu, "")
		.trim()
		.replace(/\s+/gu, " ")
		.toLowerCase();
}

export function normalizeSignalChannelName(value: string) {
	// These known channel decorations are presentation only; all other characters stay significant.
	return normalizeSignalSourceName(value).replace(/^[📈📉\s]+|[📈📉\s]+$/gu, "");
}

export interface SignalSourceNames {
	platform: string;
	serverName: string;
	channelName: string;
	categoryName?: string;
}

export function getSignalSourceKeys(input: SignalSourceNames) {
	return {
		platformKey: normalizeSignalSourceName(input.platform),
		serverKey: normalizeSignalSourceName(input.serverName),
		channelKey: normalizeSignalChannelName(input.channelName),
		categoryKey: normalizeSignalSourceName(input.categoryName ?? ""),
	};
}

export async function findSignalSourceBindings(input: SignalSourceNames) {
	const keys = getSignalSourceKeys(input);
	return db.signalSourceBinding.findMany({
		where: {
			platformKey: keys.platformKey,
			serverKey: keys.serverKey,
			channelKey: keys.channelKey,
			...(keys.categoryKey ? { categoryKey: keys.categoryKey } : {}),
		},
		include: { trader: true },
		take: 2,
	});
}

export async function listSignalSourceBindings() {
	const [bindings, traders] = await Promise.all([
		db.signalSourceBinding.findMany({
			include: {
				trader: { select: { id: true, name: true, displayName: true, isActive: true } },
			},
			orderBy: [{ serverName: "asc" }, { channelName: "asc" }],
		}),
		db.trader.findMany({
			select: { id: true, name: true, displayName: true, isActive: true },
			orderBy: { name: "asc" },
		}),
	]);
	return { bindings, traders };
}

export interface SaveSignalSourceBindingInput extends SignalSourceNames {
	id?: string;
	traderId: string;
	isActive: boolean;
}

export async function saveSignalSourceBinding(input: SaveSignalSourceBindingInput) {
	const keys = getSignalSourceKeys(input);
	if (!keys.platformKey || !keys.serverKey || !keys.channelKey)
		throw new Error("EMPTY_SOURCE_NAME");
	const data = {
		platform: input.platform.trim(),
		serverName: input.serverName.trim(),
		channelName: input.channelName.trim(),
		categoryName: input.categoryName?.trim() ?? "",
		...keys,
		traderId: input.traderId,
		isActive: input.isActive,
	};
	return input.id
		? db.signalSourceBinding.update({ where: { id: input.id }, data })
		: db.signalSourceBinding.create({ data });
}
