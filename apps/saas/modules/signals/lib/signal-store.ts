import { createHash } from "node:crypto";

import { db } from "@repo/database";
import type { Prisma } from "@repo/database";

import {
	BLOCKED_TRADER_NAMES,
	getSignalBusinessKey,
	getTraderExternalId,
	isBlockedSignalTrader,
	isDemoStrategyTrader,
	normalizeSignalIdentityPart,
} from "./signal-identity";
import { SignalSourceError } from "./signal-source-error";
import { resolveSignalSource } from "./signal-source-resolver";
import type {
	StoredSignal,
	SignalsPreviewResponse,
	WebhookSignalDirection,
	WebhookSignalEntryStatus,
	WebhookSignalStatus,
} from "./signal-types";
import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";

type SignalWithTrader = Prisma.SignalGetPayload<{
	include: {
		trader: true;
		tradingSymbol: true;
	};
}>;

interface ListStoredSignalsInput {
	cursor?: string;
	direction?: WebhookSignalDirection;
	entryStatus?: WebhookSignalEntryStatus;
	limit?: number;
	sourceIds?: string[];
	status?: WebhookSignalStatus;
	submittedAfter?: Date;
	symbol?: string;
}

interface SignalListCursor {
	id: string;
	submittedAt: string;
}

interface ListStoredSignalsResult {
	counts: Record<WebhookSignalStatus, number>;
	nextCursor: string | null;
	signals: StoredSignal[];
}

const DEFAULT_SIGNALS_LIMIT = 200;
const SIGNAL_LIST_STATUSES = ["active", "history"] as const;

function getRiskReward(
	input: Pick<ParsedSignalWebhookRequest, "direction" | "entry" | "stopLoss" | "takeProfit">,
) {
	if (input.takeProfit === undefined) {
		return 0;
	}

	const profit =
		input.direction === "long"
			? input.takeProfit - input.entry
			: input.entry - input.takeProfit;
	const risk =
		input.direction === "long" ? input.entry - input.stopLoss : input.stopLoss - input.entry;

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

	return `${sourcePlatform}:${traderExternalId}:${input.symbol}:${input.direction}:${digest}`.slice(
		0,
		160,
	);
}

function getStoredSignalBusinessKey(signal: SignalWithTrader) {
	return getSignalBusinessKey(
		{
			direction: signal.direction as ParsedSignalWebhookRequest["direction"],
			entry: signal.entry,
			stopLoss: signal.stopLoss,
			symbol: signal.tradingSymbol.symbol,
			takeProfit: signal.takeProfit ?? undefined,
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
		takeProfit: signal.takeProfit ?? undefined,
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

function encodeSignalListCursor(signal: Pick<SignalWithTrader, "id" | "submittedAt">) {
	const cursor: SignalListCursor = {
		id: signal.id,
		submittedAt: signal.submittedAt.toISOString(),
	};

	return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeSignalListCursor(cursor: string | undefined) {
	if (!cursor) {
		return null;
	}

	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		) as Partial<SignalListCursor>;
		const submittedAt = parsed.submittedAt ? new Date(parsed.submittedAt) : null;

		if (!parsed.id || !submittedAt || Number.isNaN(submittedAt.getTime())) {
			return null;
		}

		return {
			id: parsed.id,
			submittedAt,
		};
	} catch {
		return null;
	}
}

function getVisibleSignalsWhere(input: ListStoredSignalsInput = {}): Prisma.SignalWhereInput {
	const blockedNames = BLOCKED_TRADER_NAMES.map((name) => ({
		name: {
			equals: name,
			mode: "insensitive" as const,
		},
	}));
	const where: Prisma.SignalWhereInput = {
		NOT: {
			trader: {
				OR: blockedNames,
			},
		},
	};

	if (input.direction) {
		where.direction = input.direction;
	}

	if (input.entryStatus) {
		where.entryStatus = input.entryStatus;
	}

	if (input.sourceIds?.length) {
		where.trader = {
			externalId: {
				in: input.sourceIds,
			},
		};
	}

	if (input.status) {
		where.status = input.status;
	}

	if (input.submittedAfter) {
		where.submittedAt = {
			gte: input.submittedAfter,
		};
	}

	if (input.symbol) {
		where.tradingSymbol = {
			symbol: input.symbol,
		};
	}

	return where;
}

export async function listSignalPreviewTraders(): Promise<SignalsPreviewResponse["sources"]> {
	const traders = await db.trader.findMany({
		where: {
			isActive: true,
			signals: { some: {} },
		},
		select: {
			avatarUrl: true,
			displayName: true,
			externalId: true,
			handle: true,
			name: true,
			platform: true,
		},
		orderBy: { displayName: "asc" },
		take: 50,
	});

	return traders
		.filter((trader) => {
			const source = { name: trader.displayName ?? trader.name };
			return !isBlockedSignalTrader(source) && !isDemoStrategyTrader(source);
		})
		.map((trader) => ({
			avatarUrl: trader.avatarUrl ?? undefined,
			handle: trader.handle ?? undefined,
			id: trader.externalId,
			name: trader.displayName ?? trader.name,
			platform: trader.platform ?? undefined,
		}))
		.slice(0, 8);
}

export async function listActiveTradingSymbols() {
	const symbols = await db.tradingSymbol.findMany({
		where: { isActive: true },
		select: {
			baseAsset: true,
			displayName: true,
			exchange: true,
			id: true,
			logoUrl: true,
			pricePrecision: true,
			quoteAsset: true,
			symbol: true,
		},
		orderBy: [{ baseAsset: "asc" }, { quoteAsset: "asc" }],
	});

	return symbols.map((symbol) => ({
		...symbol,
		displayName: symbol.displayName ?? undefined,
		logoUrl: symbol.logoUrl ?? undefined,
		pricePrecision: symbol.pricePrecision ?? undefined,
	}));
}

export async function listStoredSignals(
	input: ListStoredSignalsInput = {},
): Promise<ListStoredSignalsResult> {
	const limit = input.limit ?? DEFAULT_SIGNALS_LIMIT;
	const cursor = decodeSignalListCursor(input.cursor);
	const cursorWhere: Prisma.SignalWhereInput = cursor
		? {
				OR: [
					{
						submittedAt: {
							lt: cursor.submittedAt,
						},
					},
					{
						id: {
							lt: cursor.id,
						},
						submittedAt: cursor.submittedAt,
					},
				],
			}
		: {};
	const visibleWhere = getVisibleSignalsWhere(input);
	const where: Prisma.SignalWhereInput = {
		AND: [visibleWhere, cursorWhere],
	};
	const signals = await db.signal.findMany({
		include: {
			trader: true,
			tradingSymbol: true,
		},
		orderBy: [
			{
				submittedAt: "desc",
			},
			{
				id: "desc",
			},
		],
		take: limit + 1,
		where,
	});
	const countWhere = getVisibleSignalsWhere({
		...input,
		cursor: undefined,
		status: undefined,
	});
	const [activeCount, historyCount] = await Promise.all(
		SIGNAL_LIST_STATUSES.map((status) =>
			db.signal.count({
				where: {
					AND: [
						countWhere,
						{
							status,
						},
					],
				},
			}),
		),
	);
	const pageSourceSignals = signals.slice(0, limit);
	const dedupedSignals = dedupeStoredSignals(pageSourceSignals);
	const pageSignals = dedupedSignals.slice(0, limit);
	const lastSourceSignal = pageSourceSignals.at(-1);

	return {
		counts: {
			active: activeCount,
			history: historyCount,
		},
		nextCursor:
			signals.length > limit && lastSourceSignal
				? encodeSignalListCursor(lastSourceSignal)
				: null,
		signals: pageSignals.map(signalModelToStoredSignal),
	};
}

export async function upsertStoredSignal(
	input: ParsedSignalWebhookRequest,
): Promise<StoredSignal | null> {
	if (isBlockedSignalTrader(input.source)) {
		return null;
	}

	const now = new Date();
	const submittedAt = input.submittedAt ? new Date(input.submittedAt) : now;
	const boundTrader = await resolveSignalSource(input.source);
	const traderExternalId = boundTrader?.externalId ?? getTraderExternalId(input);
	const eventId = input.eventId ?? getStableEventId(input, traderExternalId);
	const businessKey = getSignalBusinessKey(input, traderExternalId);
	const symbolAssets = getSymbolAssets(input.symbol);
	const trader =
		boundTrader ??
		(await db.trader.upsert({
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
		}));
	if (input.eventId) {
		const existing = await db.signal.findUnique({
			where: { eventId: input.eventId },
			select: { traderId: true },
		});
		if (existing && existing.traderId !== trader.id)
			throw new SignalSourceError(
				"EVENT_SOURCE_CONFLICT",
				"This eventId belongs to a different KOL. It cannot be reassigned by webhook.",
			);
	}
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
					...(input.takeProfit === undefined
						? []
						: [
								{
									direction: input.direction,
									entry: input.entry,
									stopLoss: input.stopLoss,
									symbolId: tradingSymbol.id,
									takeProfit: input.takeProfit,
									traderId: trader.id,
								},
							]),
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
		takeProfit: input.takeProfit ?? null,
		timeframe: input.timeframe,
	};
	const signal = existingSignalByBusinessKey
		? await db.signal.update({
				data: {
					...signalData,
					trader: {
						connect: {
							id: trader.id,
						},
					},
					tradingSymbol: {
						connect: {
							id: tradingSymbol.id,
						},
					},
				},
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
					trader: {
						connect: {
							id: trader.id,
						},
					},
					tradingSymbol: {
						connect: {
							id: tradingSymbol.id,
						},
					},
				},
				include: {
					trader: true,
					tradingSymbol: true,
				},
			});

	return signalModelToStoredSignal(signal);
}
