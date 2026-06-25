import type { ParsedSignalWebhookRequest } from "./signal-webhook-schema";

const BLOCKED_TRADER_NAMES = new Set([
	"1",
	"ai信号",
	"unknown",
	"unknowntrader",
	"uunknown",
	"未知交易员",
	"链云:未知交易员",
	"链云信号",
]);

export function normalizeSignalIdentityPart(value: string) {
	return value
		.normalize("NFKC")
		.trim()
		.toLowerCase()
		.replace(/[—–]/g, "-")
		.replace(/\s+/g, "");
}

export function isBlockedSignalTraderName(value: string) {
	return BLOCKED_TRADER_NAMES.has(normalizeSignalIdentityPart(value));
}

export function isBlockedSignalTrader(source: Pick<ParsedSignalWebhookRequest["source"], "name">) {
	return isBlockedSignalTraderName(source.name);
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
	input: Pick<ParsedSignalWebhookRequest, "direction" | "entry" | "stopLoss" | "symbol" | "takeProfit">,
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
