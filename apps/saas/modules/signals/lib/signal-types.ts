export const WEBHOOK_SIGNAL_DIRECTIONS = ["long", "short"] as const;
export const WEBHOOK_SIGNAL_ENTRY_STATUSES = ["pending", "entered"] as const;
export const WEBHOOK_SIGNAL_STATUSES = ["active", "history"] as const;

export type WebhookSignalDirection = (typeof WEBHOOK_SIGNAL_DIRECTIONS)[number];
export type WebhookSignalEntryStatus = (typeof WEBHOOK_SIGNAL_ENTRY_STATUSES)[number];
export type WebhookSignalStatus = (typeof WEBHOOK_SIGNAL_STATUSES)[number];

export interface SignalWebhookSource {
	id?: string;
	name: string;
	avatarUrl?: string;
	bio?: string;
	handle?: string;
	platform?: string;
}

export interface SignalWebhookRequest {
	chartPositionPct?: number;
	direction: WebhookSignalDirection;
	entry: number;
	entryStatus?: WebhookSignalEntryStatus;
	eventId?: string;
	exchange?: string;
	note?: string;
	outcome?: string;
	source: SignalWebhookSource;
	status?: WebhookSignalStatus;
	stopLoss: number;
	submittedAt?: string;
	symbol: string;
	takeProfit?: number;
	timeframe?: string;
}

export interface StoredTradingSymbol {
	baseAsset: string;
	displayName?: string;
	exchange: string;
	id: string;
	logoUrl?: string;
	pricePrecision?: number;
	quoteAsset: string;
	symbol: string;
}

export interface StoredSignal extends Required<Pick<SignalWebhookRequest, "direction" | "entry" | "source" | "stopLoss" | "symbol">> {
	chartPositionPct: number;
	createdAt: string;
	entryStatus: WebhookSignalEntryStatus;
	eventId: string;
	exchange?: string;
	id: string;
	note?: string;
	outcome?: string;
	riskReward: number;
	status: WebhookSignalStatus;
	submittedAt: string;
	takeProfit?: number;
	timeframe?: string;
	tradingSymbol: StoredTradingSymbol;
	updatedAt: string;
}

export interface SignalsListResponse {
	signals: StoredSignal[];
}

export interface SignalKline {
	close: number;
	high: number;
	low: number;
	open: number;
	time: number;
}

export interface SignalKlinesResponse {
	klines: SignalKline[];
	source: "binance";
	symbol: string;
	timeframe: string;
}

export interface SignalWebhookSuccessResponse {
	ignored?: boolean;
	ok: true;
	receivedAt: string;
	signal?: StoredSignal;
}

export interface SignalWebhookErrorResponse {
	error: string;
	issues?: unknown;
	ok: false;
}
