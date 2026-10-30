import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";

export const BLOCKED_TRADER_NAMES = [
	"1",
	"ai信号",
	"unknown",
	"unknowntrader",
	"uunknown",
	"未知交易员",
	"链云:未知交易员",
	"链云信号",
] as const;

const BLOCKED_TRADER_NAME_SET: ReadonlySet<string> = new Set(BLOCKED_TRADER_NAMES);

export function normalizeSignalIdentityPart(value: string) {
	return value
		.normalize("NFKC")
		.trim()
		.toLowerCase()
		.replace(/[—–]/g, "-")
		.replace(/\s+/g, "");
}

export function isBlockedSignalTraderName(value: string) {
	return BLOCKED_TRADER_NAME_SET.has(normalizeSignalIdentityPart(value));
}

export function isBlockedSignalTrader(source: Pick<ParsedSignalWebhookRequest["source"], "name">) {
	return isBlockedSignalTraderName(source.name);
}

export function isDemoStrategyTrader(source: Pick<ParsedSignalWebhookRequest["source"], "name">) {
	const normalizedName = source.name.normalize("NFKC").replace(/\s+/g, "");

	return /^演示策略0?[1-8]$/u.test(normalizedName);
}

export function getTraderExternalId(input: ParsedSignalWebhookRequest) {
	const sourcePlatform = normalizeSignalIdentityPart(input.source.platform || "webhook");
	const sourceName = normalizeSignalIdentityPart(input.source.name);

	return `${sourcePlatform}:${sourceName}`.slice(0, 160);
}

export function normalizeSignalPrice(value: number) {
	return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export function getSignalBusinessKey(
	input: Pick<
		ParsedSignalWebhookRequest,
		"direction" | "entry" | "stopLoss" | "symbol" | "takeProfit"
	>,
	traderExternalId: string,
) {
	return [
		traderExternalId,
		input.symbol,
		input.direction,
		normalizeSignalPrice(input.entry),
		input.takeProfit === undefined ? "no-tp" : normalizeSignalPrice(input.takeProfit),
		normalizeSignalPrice(input.stopLoss),
	].join("|");
}
