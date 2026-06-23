import { db } from "@repo/database";
import type { Prisma } from "@repo/database";
import { createHash } from "node:crypto";

import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";
import {
	getSignalBusinessKey,
	getTraderExternalId,
	isBlockedSignalTrader,
	normalizeSignalIdentityPart,
	normalizeSignalPrice,
} from "./signal-identity";
import type { StoredSignal } from "./signal-types";

type SignalWithTrader = Prisma.SignalGetPayload<{
	include: {
		trader: true;
		tradingSymbol: true;
	};
}>;

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

function getSymbolAssets(symbol: string) {
	const quoteAssets = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;
	const quoteAsset = quoteAssets.find((quote) => symbol.endsWith(quote)) ?? "";
	const baseAsset = quoteAsset ? symbol.slice(0, -quoteAsset.length) : symbol;

	return {
		baseAsset: baseAsset || symbol,
		displayName: quoteAsset ? `${baseAsset}/${quoteAsset}` : symbol,
		quoteAsset,
	};
}

function getStableEventId(input: ParsedSignalWebhookRequest, traderExternalId: string) {
	const sourcePlatform = normalizeSignalIdentityPart(input.source.platform || "webhook");
	const digest = createHash("sha256")
		.update(getSignalBusinessKey(input, traderExternalId))
		.digest("hex")
		.slice(0, 16);

	return `${sourcePlatform}:${traderExternalId}:${input.symbol}:${input.direction}:${digest}`.slice(0, 160);
}

function getStoredSignalBusinessKey(signal: SignalWithTrader) {
	return getSignalBusinessKey(
		{
			direction: signal.direction as ParsedSignalWebhookRequest["direction"],
			entry: signal.entry,
			stopLoss: signal.stopLoss,
			symbol: signal.tradingSymbol.symbol,
			takeProfit: signal.takeProfit,
		},
		signal.trader.externalId,
	);
}

function dedupeStoredSignals(signals: SignalWithTrader[]) {
	const seenKeys = new Set<string>();

	return signals.filter((signal) => {
		if (isBlockedSignalTrader(signal.trader)) {
			return false;
		}

		const signalKey = getStoredSignalBusinessKey(signal);

		if (seenKeys.has(signalKey)) {
			return false;
		}

		seenKeys.add(signalKey);
		return true;
	});
}

function signalModelToStoredSignal(signal: SignalWithTrader): StoredSignal {
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
			avatarUrl: signal.trader.avatarUrl ?? undefined,
			bio: signal.trader.bio ?? undefined,
			handle: signal.trader.handle ?? undefined,
			id: signal.trader.externalId,
			name: signal.trader.displayName ?? signal.trader.name,
			platform: signal.trader.platform ?? undefined,
		},
		status: signal.status as StoredSignal["status"],
		stopLoss: signal.stopLoss,
		submittedAt: signal.submittedAt.toISOString(),
		symbol: signal.tradingSymbol.symbol,
		takeProfit: signal.takeProfit,
		timeframe: signal.timeframe ?? undefined,
		tradingSymbol: {
			baseAsset: signal.tradingSymbol.baseAsset,
			displayName: signal.tradingSymbol.displayName ?? undefined,
			exchange: signal.tradingSymbol.exchange,
			id: signal.tradingSymbol.id,
			logoUrl: signal.tradingSymbol.logoUrl ?? undefined,
			pricePrecision: signal.tradingSymbol.pricePrecision ?? undefined,
			quoteAsset: signal.tradingSymbol.quoteAsset,
			symbol: signal.tradingSymbol.symbol,
		},
		updatedAt: signal.updatedAt.toISOString(),
	};
}

export async function listStoredSignals(): Promise<StoredSignal[]> {
	const signals = await db.signal.findMany({
		include: {
			trader: true,
			tradingSymbol: true,
		},
		orderBy: {
			submittedAt: "desc",
		},
		take: 200,
	});

	return dedupeStoredSignals(signals).map(signalModelToStoredSignal);
}

export async function upsertStoredSignal(input: ParsedSignalWebhookRequest): Promise<StoredSignal | null> {
	if (isBlockedSignalTrader(input.source)) {
		return null;
	}

	const now = new Date();
	const submittedAt = input.submittedAt ? new Date(input.submittedAt) : now;
	const traderExternalId = getTraderExternalId(input);
	const eventId = input.eventId ?? getStableEventId(input, traderExternalId);
	const businessKey = getSignalBusinessKey(input, traderExternalId);
	const symbolAssets = getSymbolAssets(input.symbol);
	const trader = await db.trader.upsert({
		create: {
			avatarUrl: input.source.avatarUrl,
			bio: input.source.bio,
			externalId: traderExternalId,
			handle: input.source.handle,
			name: input.source.name,
			platform: input.source.platform,
		},
		update: {
			avatarUrl: input.source.avatarUrl,
			bio: input.source.bio,
			handle: input.source.handle,
			isActive: true,
			name: input.source.name,
			platform: input.source.platform,
		},
		where: {
			externalId: traderExternalId,
		},
	});
	const tradingSymbol = await db.tradingSymbol.upsert({
		create: {
			baseAsset: symbolAssets.baseAsset,
			displayName: symbolAssets.displayName,
			exchange: input.exchange ?? "binance",
			quoteAsset: symbolAssets.quoteAsset,
			symbol: input.symbol,
		},
		update: {
			baseAsset: symbolAssets.baseAsset,
			displayName: symbolAssets.displayName,
			exchange: input.exchange ?? "binance",
			isActive: true,
			quoteAsset: symbolAssets.quoteAsset,
		},
		where: {
			symbol: input.symbol,
		},
	});
	const signalInclude = {
		trader: true,
		tradingSymbol: true,
	} satisfies Prisma.SignalInclude;
	const existingSignalByEventId = await db.signal.findUnique({
		include: signalInclude,
		where: {
			eventId,
		},
	});
	const existingSignalByBusinessKey =
		existingSignalByEventId ??
		(await db.signal.findFirst({
			include: signalInclude,
			orderBy: {
				submittedAt: "desc",
			},
			where: {
				OR: [
					{
						businessKey,
					},
					{
						direction: input.direction,
						entry: input.entry,
						stopLoss: input.stopLoss,
						symbolId: tradingSymbol.id,
						takeProfit: input.takeProfit,
						traderId: trader.id,
					},
				],
			},
		}));
	const signalData = {
		businessKey,
		chartPositionPct: getChartPosition(input),
		direction: input.direction,
		entry: input.entry,
		entryStatus: input.entryStatus ?? "pending",
		exchange: input.exchange,
		note: input.note,
		outcome: input.outcome,
		riskReward: getRiskReward(input),
		status: input.status ?? "active",
		stopLoss: input.stopLoss,
		submittedAt,
		symbolId: tradingSymbol.id,
		takeProfit: input.takeProfit,
		timeframe: input.timeframe,
		traderId: trader.id,
	};
	const signal = existingSignalByBusinessKey
		? await db.signal.update({
				data: signalData,
				include: {
					trader: true,
					tradingSymbol: true,
				},
				where: {
					id: existingSignalByBusinessKey.id,
				},
			})
		: await db.signal.create({
				data: {
					...signalData,
					eventId,
				},
				include: {
					trader: true,
					tradingSymbol: true,
				},
			});

	return signalModelToStoredSignal(signal);
}
