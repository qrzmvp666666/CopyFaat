import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	resolve: vi.fn(),
	traderUpsert: vi.fn(),
	symbolUpsert: vi.fn(),
	find: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
}));
vi.mock("@repo/database", () => ({
	db: {
		trader: { upsert: mocks.traderUpsert },
		tradingSymbol: { upsert: mocks.symbolUpsert },
		signal: {
			findUnique: mocks.find,
			findFirst: vi.fn(),
			create: mocks.create,
			update: mocks.update,
		},
	},
}));
vi.mock("./signal-source-resolver", () => ({ resolveSignalSource: mocks.resolve }));
import { upsertStoredSignal } from "./signal-store";
const trader = {
	id: "existing-kol",
	externalId: "signalfast-guide:san-ma-ge",
	name: "三马哥",
	platform: "SignalFast",
};
const symbol = { id: "symbol", symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT" };
const input = {
	eventId: "capture-original",
	source: {
		name: "三马哥合约",
		platform: "discord",
		serverName: "币圈策略搬运工",
		channelName: "三马哥合约",
	},
	direction: "long" as const,
	symbol: "BTCUSDT",
	entry: 100,
	stopLoss: 90,
	takeProfit: 120,
};
beforeEach(() => {
	vi.resetAllMocks();
	mocks.resolve.mockResolvedValue(trader);
	mocks.symbolUpsert.mockResolvedValue(symbol);
	mocks.find.mockResolvedValue(null);
	mocks.create.mockImplementation(async ({ data }) => ({
		...data,
		id: "saved",
		createdAt: new Date(),
		updatedAt: new Date(),
		trader,
		tradingSymbol: symbol,
	}));
});
describe("binding-aware signal persistence", () => {
	it("uses the bound trader and leaves its name, platform and externalId intact", async () => {
		const saved = await upsertStoredSignal(input);
		expect(mocks.traderUpsert).not.toHaveBeenCalled();
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					businessKey: expect.stringContaining("signalfast-guide:san-ma-ge"),
					trader: { connect: { id: trader.id } },
				}),
			}),
		);
		expect(saved?.source).toMatchObject({
			id: trader.externalId,
			name: "三马哥",
			platform: "SignalFast",
		});
	});
	it("rejects an existing eventId owned by a different KOL before writing symbols or signals", async () => {
		mocks.find.mockResolvedValue({ traderId: "other-kol" });
		await expect(upsertStoredSignal(input)).rejects.toMatchObject({
			code: "EVENT_SOURCE_CONFLICT",
		});
		expect(mocks.symbolUpsert).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
