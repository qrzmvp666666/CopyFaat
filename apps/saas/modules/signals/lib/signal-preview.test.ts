import { describe, expect, it } from "vitest";

import { createSignalsPreview } from "./signal-preview";
import type { StoredSignal } from "./signal-types";

function createSignal(): StoredSignal {
	return {
		id: "private-id",
		eventId: "private-event",
		createdAt: "2026-10-29T00:00:00Z",
		updatedAt: "2026-10-29T00:00:00Z",
		submittedAt: "2026-10-29T00:00:00Z",
		chartPositionPct: 50,
		direction: "long",
		entry: 80000,
		stopLoss: 79000,
		takeProfit: 82000,
		riskReward: 2,
		entryStatus: "entered",
		status: "active",
		symbol: "BTCUSDT",
		note: "private trading commentary",
		source: {
			id: "trader",
			name: "Actual Trader",
			avatarUrl: "/avatar.png",
			bio: "private bio",
		},
		tradingSymbol: {
			id: "btc",
			symbol: "BTCUSDT",
			baseAsset: "BTC",
			quoteAsset: "USDT",
			exchange: "binance",
		},
	};
}

describe("public workspace preview", () => {
	it("returns three public signal summaries without member trading details", () => {
		const result = JSON.parse(JSON.stringify(createSignalsPreview([createSignal()])));
		expect(result).toEqual({
			signals: [
				{
					avatarUrl: "/avatar.png",
					direction: "long",
					sourceName: "Actual Trader",
					status: "active",
					submittedAt: "2026-10-29T00:00:00Z",
					symbol: "BTCUSDT",
				},
			],
			sources: [{ id: "trader", name: "Actual Trader", avatarUrl: "/avatar.png" }],
			tradingSymbols: [
				{
					id: "btc",
					symbol: "BTCUSDT",
					baseAsset: "BTC",
					quoteAsset: "USDT",
					exchange: "binance",
				},
			],
		});
		expect(JSON.stringify(result)).not.toMatch(
			/entry|takeProfit|stopLoss|note|eventId|riskReward/i,
		);
	});

	it("deduplicates metadata and excludes generated demo strategies", () => {
		const signal = createSignal();
		const demo = { ...signal, source: { name: "演示策略01" } };
		const result = createSignalsPreview([signal, signal, demo]);
		expect(result.sources).toHaveLength(1);
		expect(result.tradingSymbols).toHaveLength(1);
		expect(result.signals).toHaveLength(1);
	});

	it("limits the public signal summaries to the first three real signals", () => {
		const signals = Array.from({ length: 5 }, (_, index) => ({
			...createSignal(),
			submittedAt: `2026-10-29T00:0${index}:00Z`,
			source: { name: `Trader ${index}` },
		}));
		const result = createSignalsPreview(signals);
		expect(result.signals).toHaveLength(3);
		expect(result.signals.map((signal) => signal.sourceName)).toEqual([
			"Trader 0",
			"Trader 1",
			"Trader 2",
		]);
	});

	it("keeps real trader profiles visible when signal summaries are unavailable", () => {
		const traders = [
			{ id: "trader-a", name: "Real trader A", avatarUrl: "https://example.com/a.png" },
			{ id: "trader-b", name: "Real trader B" },
		];
		const result = createSignalsPreview([], traders);
		expect(result.sources).toEqual(traders);
		expect(result.signals).toEqual([]);
	});
});
