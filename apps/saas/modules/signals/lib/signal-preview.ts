import { isBlockedSignalTrader, isDemoStrategyTrader } from "./signal-identity";
import type { SignalsPreviewResponse, StoredSignal } from "./signal-types";

export function createSignalsPreview(
	signals: StoredSignal[],
	traders: SignalsPreviewResponse["sources"] = [],
): SignalsPreviewResponse {
	const sources = new Map<string, SignalsPreviewResponse["sources"][number]>(
		traders.map((trader) => [trader.id ?? trader.name, trader]),
	);
	const tradingSymbols = new Map<string, SignalsPreviewResponse["tradingSymbols"][number]>();
	const previewSignals: SignalsPreviewResponse["signals"] = [];
	const seenSignalKeys = new Set<string>();
	for (const signal of signals) {
		if (isBlockedSignalTrader(signal.source) || isDemoStrategyTrader(signal.source)) continue;
		const { id, name, avatarUrl, handle, platform } = signal.source;
		sources.set(id ?? name, { id, name, avatarUrl, handle, platform });
		const signalKey = [id ?? name, signal.symbol, signal.direction, signal.submittedAt].join(
			"|",
		);
		if (!seenSignalKeys.has(signalKey) && previewSignals.length < 3) {
			seenSignalKeys.add(signalKey);
			previewSignals.push({
				avatarUrl,
				direction: signal.direction,
				sourceName: name,
				status: signal.status,
				submittedAt: signal.submittedAt,
				symbol: signal.symbol,
			});
		}
		const symbol = signal.tradingSymbol;
		if (symbol.exchange.toLowerCase() === "binance") {
			tradingSymbols.set(symbol.symbol, {
				id: symbol.id,
				symbol: symbol.symbol,
				baseAsset: symbol.baseAsset,
				quoteAsset: symbol.quoteAsset,
				exchange: symbol.exchange,
				displayName: symbol.displayName,
				logoUrl: symbol.logoUrl,
				pricePrecision: symbol.pricePrecision,
			});
		}
	}
	return {
		signals: previewSignals,
		sources: [...sources.values()],
		tradingSymbols: [...tradingSymbols.values()],
	};
}
