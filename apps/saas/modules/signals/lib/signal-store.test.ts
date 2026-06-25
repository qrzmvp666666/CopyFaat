import { describe, expect, it } from "vitest";

import { getSignalBusinessKey, isBlockedSignalTraderName } from "./signal-identity";
import { signalWebhookRequestSchema } from "./signal-webhook-schema";

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

	it("keeps a stable identity for signals without take profit", () => {
		const firstKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200,
				stopLoss: 62000,
				symbol: "BTCUSDT",
			},
			"webhook:舒琴操作日记vip分享",
		);
		const secondKey = getSignalBusinessKey(
			{
				direction: "long",
				entry: 63200,
				stopLoss: 62000,
				symbol: "BTCUSDT",
			},
			"webhook:舒琴操作日记vip分享",
		);

		expect(secondKey).toBe(firstKey);
	});
});

describe("signalWebhookRequestSchema", () => {
	const basePayload = {
		direction: "long",
		entry: 63200,
		source: {
			name: "舒琴操作日记VIP分享",
			platform: "链云",
		},
		stopLoss: 62000,
		symbol: "BTC/USDT",
	};

	it("accepts signals with entry and stop loss when take profit is missing", () => {
		const parsed = signalWebhookRequestSchema.safeParse(basePayload);

		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.takeProfit).toBeUndefined();
			expect(parsed.data.symbol).toBe("BTCUSDT");
		}
	});

	it("rejects signals without stop loss", () => {
		const parsed = signalWebhookRequestSchema.safeParse({
			...basePayload,
			stopLoss: undefined,
			takeProfit: 64600,
		});

		expect(parsed.success).toBe(false);
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
