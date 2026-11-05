import { db } from "../packages/database/prisma/client.ts";

const KOLS = [
	{
		externalId: "signalfast-guide:san-ma-ge",
		name: "三马哥",
		avatarUrl: "/images/hero-floating/icon-1.png",
	},
	{
		externalId: "signalfast-guide:fei-yang",
		name: "飞扬",
		avatarUrl: "/images/hero-floating/icon-2.png",
	},
	{
		externalId: "signalfast-guide:suo-zhang",
		name: "所长",
		avatarUrl: "/images/hero-floating/icon-3.png",
	},
	{
		externalId: "signalfast-guide:jun-zhang",
		name: "军长",
		avatarUrl: "/images/hero-floating/icon-4.png",
	},
	{
		externalId: "signalfast-guide:shu-qin",
		name: "舒琴",
		avatarUrl: "/images/hero-floating/onboarding-kol-5.png",
	},
] as const;

const SIGNALS = [
	{
		kolExternalId: "signalfast-guide:san-ma-ge",
		eventId: "signalfast-guide-btc-20261104-01",
		direction: "long",
		entry: 67420,
		takeProfit: 68560,
		stopLoss: 66850,
		entryStatus: "entered",
		submittedAt: new Date("2026-11-05T08:00:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:fei-yang",
		eventId: "signalfast-guide-btc-20261104-02",
		direction: "short",
		entry: 67880,
		takeProfit: 67020,
		stopLoss: 68320,
		entryStatus: "pending",
		submittedAt: new Date("2026-11-04T07:30:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:suo-zhang",
		eventId: "signalfast-guide-btc-20261104-03",
		direction: "short",
		entry: 67760,
		takeProfit: 67080,
		stopLoss: 68100,
		entryStatus: "pending",
		submittedAt: new Date("2026-11-03T21:45:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:jun-zhang",
		eventId: "signalfast-guide-btc-20261104-04",
		direction: "long",
		entry: 67180,
		takeProfit: 68100,
		stopLoss: 66720,
		entryStatus: "entered",
		submittedAt: new Date("2026-11-02T06:15:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:shu-qin",
		eventId: "signalfast-guide-btc-20261104-05",
		direction: "long",
		entry: 67260,
		takeProfit: 68020,
		stopLoss: 66880,
		entryStatus: "entered",
		submittedAt: new Date("2026-11-01T05:40:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:san-ma-ge",
		eventId: "signalfast-guide-btc-20261105-06",
		direction: "short",
		entry: 68120,
		takeProfit: 67480,
		stopLoss: 68480,
		entryStatus: "pending",
		submittedAt: new Date("2026-11-04T14:10:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:fei-yang",
		eventId: "signalfast-guide-btc-20261105-07",
		direction: "long",
		entry: 67080,
		takeProfit: 67940,
		stopLoss: 66640,
		entryStatus: "entered",
		submittedAt: new Date("2026-11-03T12:25:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:suo-zhang",
		eventId: "signalfast-guide-btc-20261105-08",
		direction: "long",
		entry: 66520,
		takeProfit: 67580,
		stopLoss: 66080,
		entryStatus: "pending",
		submittedAt: new Date("2026-11-02T17:35:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:jun-zhang",
		eventId: "signalfast-guide-btc-20261105-09",
		direction: "short",
		entry: 67640,
		takeProfit: 66820,
		stopLoss: 68060,
		entryStatus: "entered",
		submittedAt: new Date("2026-11-01T18:50:00+08:00"),
	},
	{
		kolExternalId: "signalfast-guide:shu-qin",
		eventId: "signalfast-guide-btc-20261105-10",
		direction: "short",
		entry: 68240,
		takeProfit: 67420,
		stopLoss: 68680,
		entryStatus: "pending",
		submittedAt: new Date("2026-10-31T10:20:00+08:00"),
	},
] as const;

async function main() {
	const symbol = await db.tradingSymbol.upsert({
		where: { symbol: "BTCUSDT" },
		create: {
			symbol: "BTCUSDT",
			baseAsset: "BTC",
			quoteAsset: "USDT",
			exchange: "binance",
			displayName: "BTC/USDT",
			pricePrecision: 2,
		},
		update: { isActive: true },
	});

	const traderIds = new Map<string, string>();
	for (const kol of KOLS) {
		const trader = await db.trader.upsert({
			where: { externalId: kol.externalId },
			create: {
				externalId: kol.externalId,
				name: kol.name,
				displayName: kol.name,
				avatarUrl: kol.avatarUrl,
				platform: "SignalFast",
				bio: "SignalFast 演示信号，价格仅用于界面展示，不构成投资建议。",
			},
			update: {
				name: kol.name,
				displayName: kol.name,
				avatarUrl: kol.avatarUrl,
				isActive: true,
			},
		});
		traderIds.set(kol.externalId, trader.id);
	}

	for (const plan of SIGNALS) {
		const traderId = traderIds.get(plan.kolExternalId);
		if (!traderId) {
			throw new Error(`Missing trader for seed signal: ${plan.kolExternalId}`);
		}
		const risk =
			plan.direction === "long" ? plan.entry - plan.stopLoss : plan.stopLoss - plan.entry;
		const reward =
			plan.direction === "long" ? plan.takeProfit - plan.entry : plan.entry - plan.takeProfit;
		const businessKey = `${plan.kolExternalId}|BTCUSDT|${plan.direction}|${plan.entry}|${plan.takeProfit}|${plan.stopLoss}`;
		const existing = await db.signal.findFirst({
			where: { OR: [{ eventId: plan.eventId }, { businessKey }] },
			select: { id: true },
		});
		const data = {
			traderId,
			symbolId: symbol.id,
			direction: plan.direction,
			entryStatus: plan.entryStatus,
			status: "active",
			entry: plan.entry,
			takeProfit: plan.takeProfit,
			stopLoss: plan.stopLoss,
			riskReward: Number((reward / risk).toFixed(2)),
			submittedAt: plan.submittedAt,
			exchange: "binance",
			timeframe: "1h",
			note: "SignalFast 演示信号，价格仅用于界面展示，不构成投资建议。",
		};

		if (existing) {
			await db.signal.update({
				where: { id: existing.id },
				data: { ...data, eventId: plan.eventId, businessKey },
			});
		} else {
			await db.signal.create({
				data: { ...data, eventId: plan.eventId, businessKey },
			});
		}
	}

	const rows = await db.signal.findMany({
		where: { eventId: { in: SIGNALS.map((signal) => signal.eventId) } },
		include: { trader: true, tradingSymbol: true },
		orderBy: { submittedAt: "desc" },
	});
	console.info(
		JSON.stringify(
			rows.map((row) => ({
				kol: row.trader.displayName,
				avatar: row.trader.avatarUrl,
				symbol: row.tradingSymbol.symbol,
				direction: row.direction,
				entry: row.entry,
				submittedAt: row.submittedAt.toISOString(),
			})),
			null,
			2,
		),
	);
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
