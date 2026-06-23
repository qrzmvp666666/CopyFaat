import { describe, expect, it } from "vitest";

import { getSignalBusinessKey, isBlockedSignalTraderName } from "./signal-identity";

describe("getSignalBusinessKey", () => {
	it("keeps repeated captures of the same signal under one business identity", () => {
		const firstKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200,
				stopLoss: 62000,
				symbol: "BTCUSDT",
				takeProfit: 64600,
			},
			"webhook:舒琴操作日记vip分享",
		);
		const secondKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200.0,
				stopLoss: 62000.0,
				symbol: "BTCUSDT",
				takeProfit: 64600.0,
			},
			"webhook:舒琴操作日记vip分享",
		);

		expect(secondKey).toBe(firstKey);
	});

	it("separates signals when the trading plan changes", () => {
		const baseKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200,
				stopLoss: 62000,
				symbol: "BTCUSDT",
				takeProfit: 64600,
			},
			"webhook:舒琴操作日记vip分享",
		);
		const changedPlanKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200,
				stopLoss: 61800,
				symbol: "BTCUSDT",
				takeProfit: 64600,
			},
			"webhook:舒琴操作日记vip分享",
		);

		expect(changedPlanKey).not.toBe(baseKey);
	});
});

describe("isBlockedSignalTraderName", () => {
	it("blocks low-quality or unknown signal sources", () => {
		expect(isBlockedSignalTraderName("1")).toBe(true);
		expect(isBlockedSignalTraderName("未知交易员")).toBe(true);
		expect(isBlockedSignalTraderName("U Unknown")).toBe(true);
		expect(isBlockedSignalTraderName("Unknown")).toBe(true);
		expect(isBlockedSignalTraderName("Unknown Trader")).toBe(true);
		expect(isBlockedSignalTraderName("链云:未知交易员")).toBe(true);
		expect(isBlockedSignalTraderName("链云信号")).toBe(true);
		expect(isBlockedSignalTraderName("AI 信号")).toBe(true);
	});

	it("keeps named traders visible", () => {
		expect(isBlockedSignalTraderName("舒琴操作日记VIP分享")).toBe(false);
		expect(isBlockedSignalTraderName("AI 分析")).toBe(false);
		expect(isBlockedSignalTraderName("分析师 Nick")).toBe(false);
	});
});
