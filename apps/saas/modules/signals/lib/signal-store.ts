import { db } from "@repo/database";
import type { Signal } from "@repo/database";
import { randomUUID } from "node:crypto";

import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";
import type { StoredSignal } from "./signal-types";

function getRiskReward(input: Pick<ParsedSignalWebhookRequest, "direction" | "entry" | "stopLoss" | "takeProfit">) {
	const profit =
		input.direction === "long"
			? input.takeProfit - input.entry
			: input.entry - input.takeProfit;
	const risk =
		input.direction === "long"
			? input.entry - input.stopLoss
			: input.stopLoss - input.entry;

	return Number((profit / risk).toFixed(2));
}

function getChartPosition(input: ParsedSignalWebhookRequest) {
	if (typeof input.chartPositionPct === "number") {
		return input.chartPositionPct;
	}

	return 92;
}

function signalModelToStoredSignal(signal: Signal): StoredSignal {
	return {
		chartPositionPct: signal.chartPositionPct,
		createdAt: signal.createdAt.toISOString(),
		direction: signal.direction as StoredSignal["direction"],
		entry: signal.entry,
		entryStatus: signal.entryStatus as StoredSignal["entryStatus"],
		eventId: signal.eventId,
		exchange: signal.exchange ?? undefined,
		id: signal.id,
		note: signal.note ?? undefined,
		outcome: signal.outcome ?? undefined,
		riskReward: signal.riskReward,
		source: {
			avatarUrl: signal.sourceAvatarUrl ?? undefined,
			id: signal.sourceId ?? undefined,
			name: signal.sourceName,
		},
		status: signal.status as StoredSignal["status"],
		stopLoss: signal.stopLoss,
		submittedAt: signal.submittedAt.toISOString(),
		symbol: signal.symbol,
		takeProfit: signal.takeProfit,
		timeframe: signal.timeframe ?? undefined,
		updatedAt: signal.updatedAt.toISOString(),
	};
}

export async function listStoredSignals(): Promise<StoredSignal[]> {
	const signals = await db.signal.findMany({
		orderBy: {
			submittedAt: "desc",
		},
		take: 200,
	});

	return signals.map(signalModelToStoredSignal);
}

export async function upsertStoredSignal(input: ParsedSignalWebhookRequest): Promise<StoredSignal> {
	const now = new Date();
	const eventId = input.eventId ?? randomUUID();
	const submittedAt = input.submittedAt ? new Date(input.submittedAt) : now;
	const signal = await db.signal.upsert({
		create: {
			chartPositionPct: getChartPosition(input),
			direction: input.direction,
			entry: input.entry,
			entryStatus: input.entryStatus ?? "pending",
			eventId,
			exchange: input.exchange,
			note: input.note,
			outcome: input.outcome,
			riskReward: getRiskReward(input),
			sourceAvatarUrl: input.source.avatarUrl,
			sourceId: input.source.id ?? input.source.name,
			sourceName: input.source.name,
			status: input.status ?? "active",
			stopLoss: input.stopLoss,
			submittedAt,
			symbol: input.symbol,
			takeProfit: input.takeProfit,
			timeframe: input.timeframe,
		},
		update: {
			chartPositionPct: getChartPosition(input),
			direction: input.direction,
			entry: input.entry,
			entryStatus: input.entryStatus ?? "pending",
			exchange: input.exchange,
			note: input.note,
			outcome: input.outcome,
			riskReward: getRiskReward(input),
			sourceAvatarUrl: input.source.avatarUrl,
			sourceId: input.source.id ?? input.source.name,
			sourceName: input.source.name,
			status: input.status ?? "active",
			stopLoss: input.stopLoss,
			submittedAt,
			symbol: input.symbol,
			takeProfit: input.takeProfit,
			timeframe: input.timeframe,
		},
		where: {
			eventId,
		},
	});

	return signalModelToStoredSignal(signal);
}
