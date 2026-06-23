"use client";

import { Button, cn } from "@repo/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import type { UTCTimestamp } from "lightweight-charts";
import {
	BellIcon,
	ChartCandlestickIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Clock3Icon,
	Maximize2Icon,
	RadioIcon,
	RefreshCwIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	TargetIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	XCircleIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import type { SignalChartSignal } from "./TradingViewSignalChart";
import { TradingViewSignalChart } from "./TradingViewSignalChart";
import { isBlockedSignalTrader } from "../lib/signal-identity";
import type {
	SignalKlinesResponse,
	SignalsListResponse,
	StoredSignal,
	StoredTradingSymbol,
} from "../lib/signal-types";

const SUPPORTED_TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
const SIGNAL_DIRECTIONS = ["all", "long", "short"] as const;
const SIGNAL_STATUSES = ["active", "history"] as const;
const TIME_RANGES = ["all", "24h", "3d", "7d", "30d"] as const;
const ENTRY_STATUSES = ["all", "pending", "entered"] as const;

type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];
type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];
type SignalStatus = (typeof SIGNAL_STATUSES)[number];
type TimeRange = (typeof TIME_RANGES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];

interface Instrument {
	symbol: string;
	base: string;
	price: number;
	change: number;
	volume: string;
	accent: string;
	logo: string;
	pricePrecision?: number;
	tickDirection?: "down" | "up";
}

interface Source {
	id: string;
	name: string;
	handle: string;
	initials: string;
	accent: string;
	avatar: string;
}

function normalizeSourceKey(value: string) {
	return value
		.normalize("NFKC")
		.trim()
		.toLowerCase()
		.replace(/[—–]/g, "-")
		.replace(/\s+/g, "");
}

interface Candle {
	close: number;
	high: number;
	low: number;
	open: number;
	time: UTCTimestamp;
}

interface BinanceTickerStreamPayload {
	data?: {
		c?: string;
		P?: string;
		q?: string;
		s?: string;
	};
}

interface BinanceKlineStreamPayload {
	k?: {
		c?: string;
		h?: string;
		l?: string;
		o?: string;
		t?: number;
	};
}

interface TradeSignal {
	id: string;
	symbol: string;
	sourceId: string;
	sourceName: string;
	avatarLabel: string;
	avatarUrl: string;
	direction: Exclude<SignalDirection, "all">;
	entryStatus: Exclude<EntryStatus, "all">;
	status: SignalStatus;
	entry: number;
	takeProfit: number;
	stopLoss: number;
	submittedAt: string;
	submittedAtTime?: UTCTimestamp;
	confidence: number;
	x: number;
	y: number;
	outcome?: string;
}

interface SignalStatusPresentation {
	icon: LucideIcon;
	label: string;
	badgeClassName: string;
	resultIconClassName: string;
	resultValueClassName: string;
	resultLabel: string;
}

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
	"15m": 15 * 60,
	"1h": 60 * 60,
	"4h": 4 * 60 * 60,
	"1d": 24 * 60 * 60,
};

const INSTRUMENTS: Instrument[] = [
	{
		symbol: "BTCUSDT",
		base: "BTC",
		price: 69_356,
		change: -3.39,
		volume: "2.8B",
		accent: "bg-amber-500",
		logo: "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
	},
	{
		symbol: "ETHUSDT",
		base: "ETH",
		price: 2_876.2,
		change: -5.2,
		volume: "1.1B",
		accent: "bg-indigo-500",
		logo: "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png",
	},
	{
		symbol: "SOLUSDT",
		base: "SOL",
		price: 87.52,
		change: -6.01,
		volume: "438M",
		accent: "bg-violet-500",
		logo: "https://assets.coingecko.com/coins/images/4128/thumb/solana.png",
	},
];

const BINANCE_STREAM_BASE_URL = "wss://stream.binance.com:9443";
const BINANCE_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const;
const TICK_FLASH_MS = 700;

const SIGNALS: TradeSignal[] = [
	{
		id: "btc-1",
		symbol: "BTCUSDT",
		sourceId: "xinsuo",
		sourceName: "所长",
		avatarLabel: "所",
		avatarUrl: "https://i.pravatar.cc/80?img=11",
		direction: "long",
		entryStatus: "entered",
		status: "active",
		entry: 69_700,
		takeProfit: 73_825,
		stopLoss: 68_700,
		submittedAt: "03/25 17:10",
		confidence: 2.2,
		x: 88,
		y: 63,
	},
	{
		id: "btc-2",
		symbol: "BTCUSDT",
		sourceId: "feiyang",
		sourceName: "飞扬",
		avatarLabel: "飞",
		avatarUrl: "https://i.pravatar.cc/80?img=33",
		direction: "long",
		entryStatus: "entered",
		status: "active",
		entry: 69_500,
		takeProfit: 70_300,
		stopLoss: 68_900,
		submittedAt: "03/25 14:36",
		confidence: 1.74,
		x: 75,
		y: 68,
	},
	{
		id: "btc-3",
		symbol: "BTCUSDT",
		sourceId: "shanzhiwang",
		sourceName: "山寨之王",
		avatarLabel: "山",
		avatarUrl: "https://i.pravatar.cc/80?img=47",
		direction: "long",
		entryStatus: "entered",
		status: "history",
		entry: 68_324,
		takeProfit: 70_800,
		stopLoss: 67_800,
		submittedAt: "03/23 08:12",
		confidence: 1.52,
		x: 52,
		y: 76,
		outcome: "TP1",
	},
	{
		id: "btc-4",
		symbol: "BTCUSDT",
		sourceId: "xinsuo",
		sourceName: "所长",
		avatarLabel: "所",
		avatarUrl: "https://i.pravatar.cc/80?img=11",
		direction: "short",
		entryStatus: "pending",
		status: "history",
		entry: 73_350,
		takeProfit: 70_050,
		stopLoss: 74_000,
		submittedAt: "03/25 10:29",
		confidence: 0.29,
		x: 82,
		y: 41,
		outcome: "未触发",
	},
	{
		id: "eth-1",
		symbol: "ETHUSDT",
		sourceId: "xinsuo",
		sourceName: "所长",
		avatarLabel: "所",
		avatarUrl: "https://i.pravatar.cc/80?img=11",
		direction: "long",
		entryStatus: "pending",
		status: "active",
		entry: 2_876,
		takeProfit: 3_040,
		stopLoss: 2_790,
		submittedAt: "03/25 18:02",
		confidence: 1.86,
		x: 77,
		y: 59,
	},
	{
		id: "eth-2",
		symbol: "ETHUSDT",
		sourceId: "wangbot",
		sourceName: "WG Bot",
		avatarLabel: "WG",
		avatarUrl: "https://i.pravatar.cc/80?img=64",
		direction: "short",
		entryStatus: "entered",
		status: "history",
		entry: 2_945,
		takeProfit: 2_820,
		stopLoss: 3_015,
		submittedAt: "03/24 22:14",
		confidence: 0.92,
		x: 58,
		y: 39,
		outcome: "SL",
	},
	{
		id: "sol-1",
		symbol: "SOLUSDT",
		sourceId: "feiyang",
		sourceName: "飞扬",
		avatarLabel: "飞",
		avatarUrl: "https://i.pravatar.cc/80?img=33",
		direction: "long",
		entryStatus: "entered",
		status: "active",
		entry: 87.5,
		takeProfit: 94.2,
		stopLoss: 84.1,
		submittedAt: "03/25 16:45",
		confidence: 2.04,
		x: 72,
		y: 61,
	},
	{
		id: "sol-2",
		symbol: "SOLUSDT",
		sourceId: "shanzhiwang",
		sourceName: "山寨之王",
		avatarLabel: "山",
		avatarUrl: "https://i.pravatar.cc/80?img=47",
		direction: "short",
		entryStatus: "entered",
		status: "history",
		entry: 91.8,
		takeProfit: 86.6,
		stopLoss: 94.4,
		submittedAt: "03/24 19:28",
		confidence: 1.18,
		x: 48,
		y: 35,
		outcome: "TP1",
	},
	{
		id: "btc-5",
		symbol: "BTCUSDT",
		sourceId: "chengg",
		sourceName: "陈哥",
		avatarLabel: "陈",
		avatarUrl: "https://i.pravatar.cc/80?img=52",
		direction: "short",
		entryStatus: "entered",
		status: "active",
		entry: 71_200,
		takeProfit: 68_500,
		stopLoss: 72_300,
		submittedAt: "03/26 09:15",
		confidence: 1.95,
		x: 60,
		y: 44,
	},
	{
		id: "btc-6",
		symbol: "BTCUSDT",
		sourceId: "bidaoge",
		sourceName: "必到哥",
		avatarLabel: "必",
		avatarUrl: "https://i.pravatar.cc/80?img=57",
		direction: "long",
		entryStatus: "pending",
		status: "active",
		entry: 68_900,
		takeProfit: 72_400,
		stopLoss: 67_600,
		submittedAt: "03/26 11:30",
		confidence: 2.48,
		x: 92,
		y: 70,
	},
	{
		id: "btc-7",
		symbol: "BTCUSDT",
		sourceId: "shuqin",
		sourceName: "舒琴",
		avatarLabel: "舒",
		avatarUrl: "https://i.pravatar.cc/80?img=25",
		direction: "long",
		entryStatus: "pending",
		status: "active",
		entry: 69_100,
		takeProfit: 73_000,
		stopLoss: 68_200,
		submittedAt: "03/26 13:45",
		confidence: 1.62,
		x: 96,
		y: 66,
	},
	{
		id: "eth-3",
		symbol: "ETHUSDT",
		sourceId: "fengg",
		sourceName: "峰哥",
		avatarLabel: "峰",
		avatarUrl: "https://i.pravatar.cc/80?img=68",
		direction: "long",
		entryStatus: "entered",
		status: "active",
		entry: 2_830,
		takeProfit: 3_100,
		stopLoss: 2_740,
		submittedAt: "03/26 10:20",
		confidence: 2.12,
		x: 83,
		y: 55,
	},
	{
		id: "eth-4",
		symbol: "ETHUSDT",
		sourceId: "bidaoge",
		sourceName: "必到哥",
		avatarLabel: "必",
		avatarUrl: "https://i.pravatar.cc/80?img=57",
		direction: "short",
		entryStatus: "pending",
		status: "active",
		entry: 2_960,
		takeProfit: 2_750,
		stopLoss: 3_060,
		submittedAt: "03/25 20:55",
		confidence: 1.38,
		x: 68,
		y: 38,
	},
	{
		id: "sol-3",
		symbol: "SOLUSDT",
		sourceId: "chengg",
		sourceName: "陈哥",
		avatarLabel: "陈",
		avatarUrl: "https://i.pravatar.cc/80?img=52",
		direction: "long",
		entryStatus: "entered",
		status: "active",
		entry: 85.6,
		takeProfit: 92.8,
		stopLoss: 82.4,
		submittedAt: "03/26 08:30",
		confidence: 1.88,
		x: 65,
		y: 58,
	},
	{
		id: "sol-4",
		symbol: "SOLUSDT",
		sourceId: "wangbot",
		sourceName: "WG Bot",
		avatarLabel: "WG",
		avatarUrl: "https://i.pravatar.cc/80?img=64",
		direction: "short",
		entryStatus: "pending",
		status: "active",
		entry: 90.2,
		takeProfit: 84.5,
		stopLoss: 93.1,
		submittedAt: "03/26 14:10",
		confidence: 1.55,
		x: 88,
		y: 40,
	},
];

const MARKET_SEED: Record<string, number> = {
	BTCUSDT: 69_300,
	ETHUSDT: 2_875,
	SOLUSDT: 87.5,
};

const FALLBACK_LOGOS: Record<string, string> = Object.fromEntries(
	INSTRUMENTS.map((instrument) => [instrument.symbol, instrument.logo]),
);

const FALLBACK_ACCENTS = [
	"bg-sky-500",
	"bg-emerald-500",
	"bg-violet-500",
	"bg-rose-500",
	"bg-amber-500",
	"bg-cyan-500",
] as const;

const GENERATED_AVATAR_COLORS = [
	"#00C087",
	"#F6465D",
	"#F0B90B",
	"#7C5CFF",
	"#2D9CDB",
	"#E056FD",
	"#FF7A45",
	"#22C55E",
] as const;

function getSeedHash(seed: string) {
	return Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getGeneratedSvgDataUrl(seed: string, label: string, variant: "symbol" | "trader") {
	const seedHash = getSeedHash(seed);
	const background = GENERATED_AVATAR_COLORS[seedHash % GENERATED_AVATAR_COLORS.length];
	const secondary = GENERATED_AVATAR_COLORS[(seedHash + 3) % GENERATED_AVATAR_COLORS.length];
	const safeLabel = label.trim().slice(0, 2).toUpperCase();
	const fontSize = variant === "symbol" ? 34 : 30;
	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
			<defs>
				<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stop-color="${background}"/>
					<stop offset="100%" stop-color="${secondary}"/>
				</linearGradient>
			</defs>
			<rect width="96" height="96" rx="48" fill="url(#g)"/>
			<circle cx="74" cy="22" r="18" fill="rgba(255,255,255,0.18)"/>
			<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="800">${safeLabel}</text>
		</svg>
	`;

	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getAvatarLabel(sourceName: string) {
	return sourceName.trim().slice(0, 2).toUpperCase();
}

function getDefaultPricePrecision(symbol: string) {
	if (symbol.includes("BTC") || symbol.includes("ETH")) {
		return 0;
	}

	return 2;
}

function getSymbolBase(symbol: string) {
	const quoteAssets = ["USDT", "USDC", "USD", "BTC", "ETH"];
	const quoteAsset = quoteAssets.find((quote) => symbol.endsWith(quote));

	return quoteAsset ? symbol.slice(0, -quoteAsset.length) : symbol;
}

function getSymbolAccent(symbol: string) {
	const code = getSeedHash(symbol);
	return FALLBACK_ACCENTS[code % FALLBACK_ACCENTS.length];
}

function createInstrumentFromTradingSymbol(symbol: StoredTradingSymbol): Instrument {
	return {
		accent: getSymbolAccent(symbol.symbol),
		base: symbol.baseAsset || getSymbolBase(symbol.symbol),
		change: 0,
		logo:
			symbol.logoUrl ??
			FALLBACK_LOGOS[symbol.symbol] ??
			getGeneratedSvgDataUrl(symbol.symbol, symbol.baseAsset || symbol.symbol, "symbol"),
		price: 0,
		pricePrecision: symbol.pricePrecision ?? getDefaultPricePrecision(symbol.symbol),
		symbol: symbol.symbol,
		volume: "-",
	};
}

function createSourceFilterFromSignal(signal: StoredSignal): Source {
	const name = signal.source.name;
	const id = normalizeSourceKey(name);

	return {
		accent: getSymbolAccent(id),
		avatar:
			signal.source.avatarUrl ??
			getGeneratedSvgDataUrl(id, name, "trader"),
		handle: signal.source.handle ?? signal.source.platform ?? "",
		id,
		initials: getAvatarLabel(name),
		name,
	};
}

function formatSignalSubmittedAt(value: string, locale: string) {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
	}).format(date);
}

function getHistoryOutcomeTone(outcome?: string) {
	const normalizedOutcome = outcome?.trim().toLowerCase();

	if (!normalizedOutcome) {
		return "closed";
	}

	if (
		normalizedOutcome.startsWith("tp") ||
		normalizedOutcome.includes("止盈") ||
		normalizedOutcome.includes("take")
	) {
		return "profit";
	}

	if (
		normalizedOutcome.startsWith("sl") ||
		normalizedOutcome.includes("止损") ||
		normalizedOutcome.includes("stop")
	) {
		return "risk";
	}

	if (
		normalizedOutcome.includes("未触发") ||
		normalizedOutcome.includes("取消") ||
		normalizedOutcome.includes("cancel") ||
		normalizedOutcome.includes("invalid")
	) {
		return "inactive";
	}

	return "closed";
}

function getSignalStatusPresentation(
	signal: TradeSignal,
	labels: {
		closed: string;
		entered: string;
		expectedRr: string;
		pending: string;
		result: string;
	},
): SignalStatusPresentation {
	if (signal.status === "active") {
		if (signal.entryStatus === "entered") {
			return {
				badgeClassName: "border-emerald-400/35 bg-emerald-400/15 text-emerald-300",
				icon: CheckCircle2Icon,
				label: labels.entered,
				resultIconClassName: "text-emerald-400",
				resultLabel: labels.expectedRr,
				resultValueClassName: "text-emerald-400",
			};
		}

		return {
			badgeClassName: "border-amber-400/35 bg-amber-400/15 text-amber-300",
			icon: TargetIcon,
			label: labels.pending,
			resultIconClassName: "text-amber-400",
			resultLabel: labels.expectedRr,
			resultValueClassName: "text-amber-400",
		};
	}

	const label = signal.outcome?.trim() || labels.closed;
	const historyTone = getHistoryOutcomeTone(signal.outcome);

	if (historyTone === "profit") {
		return {
			badgeClassName: "border-emerald-400/35 bg-emerald-400/15 text-emerald-300",
			icon: CheckCircle2Icon,
			label,
			resultIconClassName: "text-emerald-400",
			resultLabel: labels.result,
			resultValueClassName: "text-emerald-400",
		};
	}

	if (historyTone === "risk") {
		return {
			badgeClassName: "border-rose-400/35 bg-rose-400/15 text-rose-300",
			icon: XCircleIcon,
			label,
			resultIconClassName: "text-rose-400",
			resultLabel: labels.result,
			resultValueClassName: "text-rose-400",
		};
	}

	if (historyTone === "inactive") {
		return {
			badgeClassName: "border-amber-400/35 bg-amber-400/15 text-amber-300",
			icon: Clock3Icon,
			label,
			resultIconClassName: "text-amber-400",
			resultLabel: labels.result,
			resultValueClassName: "text-amber-400",
		};
	}

	return {
		badgeClassName: "border-zinc-400/30 bg-zinc-400/15 text-zinc-200",
		icon: CheckCircle2Icon,
		label,
		resultIconClassName: "text-zinc-300",
		resultLabel: labels.result,
		resultValueClassName: "text-zinc-200",
	};
}

function mapStoredSignalToTradeSignal(signal: StoredSignal, locale: string): TradeSignal {
	const submittedAtTime = Math.floor(new Date(signal.submittedAt).getTime() / 1000);

		return {
			avatarLabel: getAvatarLabel(signal.source.name),
			avatarUrl:
				signal.source.avatarUrl ??
				getGeneratedSvgDataUrl(
					signal.source.id ?? signal.source.name,
					signal.source.name,
					"trader",
				),
		confidence: signal.riskReward,
		direction: signal.direction,
		entry: signal.entry,
		entryStatus: signal.entryStatus,
		id: signal.id,
		outcome: signal.outcome,
		sourceId: normalizeSourceKey(signal.source.name),
		sourceName: signal.source.name,
		status: signal.status,
		stopLoss: signal.stopLoss,
		submittedAt: formatSignalSubmittedAt(signal.submittedAt, locale),
		submittedAtTime: Number.isFinite(submittedAtTime)
			? (submittedAtTime as UTCTimestamp)
			: undefined,
		symbol: signal.symbol,
		takeProfit: signal.takeProfit,
		x: signal.chartPositionPct,
		y: 50,
	};
}

function upsertWebhookSignal(signals: StoredSignal[], nextSignal: StoredSignal) {
	if (isBlockedSignalTrader(nextSignal.source)) {
		return signals;
	}

	const existingIndex = signals.findIndex((signal) => signal.eventId === nextSignal.eventId);

	if (existingIndex === -1) {
		return [nextSignal, ...signals];
	}

	return signals.map((signal, index) => (index === existingIndex ? nextSignal : signal));
}

function buildFallbackCandles(symbol: string, timeframe: Timeframe): Candle[] {
	const intervalSeconds = TIMEFRAME_SECONDS[timeframe];
	const now = Math.floor(Date.now() / 1000);
	const lastCandleTime = now - (now % intervalSeconds);
	const timeframeFactor = SUPPORTED_TIMEFRAMES.indexOf(timeframe) + 1;
	const seed = MARKET_SEED[symbol] ?? 100;
	const volatility = seed * (0.006 + timeframeFactor * 0.0018);

	return Array.from({ length: 52 }, (_, index) => {
		const time = (lastCandleTime - (51 - index) * intervalSeconds) as UTCTimestamp;
		const wave = Math.sin(index * 0.42 + timeframeFactor) * volatility;
		const pull = Math.cos(index * 0.18 + timeframeFactor * 0.7) * volatility * 0.8;
		const trend = (index - 26) * volatility * 0.07;
		const open = seed + wave + pull - trend;
		const close =
			open +
			Math.sin(index * 0.87 + timeframeFactor * 1.3) * volatility * 0.74 -
			(index > 12 && index < 20 ? volatility * 0.72 : 0) +
			(index > 28 && index < 35 ? volatility * 0.9 : 0);
		const high = Math.max(open, close) + volatility * (0.45 + (index % 5) * 0.1);
		const low = Math.min(open, close) - volatility * (0.36 + (index % 4) * 0.1);

		return { close, high, low, open, time };
	});
}

function formatCompactVolume(value: number) {
	return new Intl.NumberFormat("en", {
		maximumFractionDigits: 1,
		notation: "compact",
	}).format(value);
}

function upsertCandle(candles: Candle[], nextCandle: Candle) {
	const index = candles.findIndex((candle) => candle.time === nextCandle.time);

	if (index === -1) {
		return [...candles, nextCandle].slice(-180);
	}

	return candles.map((candle, candleIndex) => (candleIndex === index ? nextCandle : candle));
}

function parseTickerPayload(eventData: string) {
	try {
		const payload = JSON.parse(eventData) as BinanceTickerStreamPayload;
		const data = payload.data;

		if (!data?.s) {
			return null;
		}

		const price = Number(data.c);
		const change = Number(data.P);
		const quoteVolume = Number(data.q);

		if (!Number.isFinite(price) || !Number.isFinite(change)) {
			return null;
		}

		return {
			change,
			price,
			symbol: data.s,
			volume: Number.isFinite(quoteVolume) ? formatCompactVolume(quoteVolume) : undefined,
		};
	} catch {
		return null;
	}
}

function parseKlinePayload(eventData: string): Candle | null {
	try {
		const payload = JSON.parse(eventData) as BinanceKlineStreamPayload;
		const kline = payload.k;

		if (!kline?.t) {
			return null;
		}

		const candle = {
			close: Number(kline.c),
			high: Number(kline.h),
			low: Number(kline.l),
			open: Number(kline.o),
			time: Math.floor(kline.t / 1000) as UTCTimestamp,
		};

		if (
			!Number.isFinite(candle.close) ||
			!Number.isFinite(candle.high) ||
			!Number.isFinite(candle.low) ||
			!Number.isFinite(candle.open)
		) {
			return null;
		}

		return candle;
	} catch {
		return null;
	}
}

function connectBinanceSocket(url: string, onMessage: (eventData: string) => void) {
	let isClosed = false;
	let reconnectAttempt = 0;
	let reconnectTimer: number | undefined;
	let socket: WebSocket | undefined;

	function connect() {
		socket = new WebSocket(url);

		socket.addEventListener("open", () => {
			reconnectAttempt = 0;
		});

		socket.addEventListener("message", (event) => {
			onMessage(String(event.data));
		});

		socket.addEventListener("close", () => {
			if (isClosed) {
				return;
			}

			const delay =
				BINANCE_RECONNECT_DELAYS_MS[
					Math.min(reconnectAttempt, BINANCE_RECONNECT_DELAYS_MS.length - 1)
				];
			reconnectAttempt += 1;
			reconnectTimer = window.setTimeout(connect, delay);
		});

		socket.addEventListener("error", () => {
			socket?.close();
		});
	}

	connect();

	return () => {
		isClosed = true;
		if (reconnectTimer) {
			window.clearTimeout(reconnectTimer);
		}
		socket?.close();
	};
}

function getSelectedSignal(signals: TradeSignal[], activeSignalId: string | null) {
	return signals.find((signal) => signal.id === activeSignalId) ?? signals[0] ?? null;
}

function matchesSelectedSources(signal: Pick<TradeSignal, "sourceId">, selectedSourceIds: string[]) {
	return selectedSourceIds.length === 0 || selectedSourceIds.includes(signal.sourceId);
}

export function SignalsWorkspace() {
	const t = useTranslations("signals");
	const locale = useLocale();
	const [webhookSignals, setWebhookSignals] = useState<StoredSignal[]>([]);
	const [binanceCandles, setBinanceCandles] = useState<Candle[]>([]);
	const [instrumentQuotes, setInstrumentQuotes] = useState<Record<string, Partial<Instrument>>>({});
	const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
	const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1h");
	const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
	const [selectedDirection, setSelectedDirection] = useState<SignalDirection>("all");
	const [selectedStatus, setSelectedStatus] = useState<SignalStatus>("active");
	const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("30d");
	const [selectedEntryStatus, setSelectedEntryStatus] = useState<EntryStatus>("all");
	const [activeSignalId, setActiveSignalId] = useState<string | null>(null);
	const [isSignalPanelCollapsed, setIsSignalPanelCollapsed] = useState(false);

	const signals = useMemo(
		() => webhookSignals.map((signal) => mapStoredSignalToTradeSignal(signal, locale)),
		[locale, webhookSignals],
	);
	const baseInstruments = useMemo(() => {
		const symbols = new Map<string, StoredTradingSymbol>();

		for (const signal of webhookSignals) {
			symbols.set(signal.tradingSymbol.symbol, signal.tradingSymbol);
		}

		return (symbols.size
			? Array.from(symbols.values()).map(createInstrumentFromTradingSymbol)
			: INSTRUMENTS
		).sort((a, b) => a.symbol.localeCompare(b.symbol));
	}, [webhookSignals]);
	const instruments = useMemo(
		() =>
			baseInstruments
				.map((instrument) => ({
					...instrument,
					...instrumentQuotes[instrument.symbol],
				}))
				.sort((a, b) => a.symbol.localeCompare(b.symbol)),
		[baseInstruments, instrumentQuotes],
	);
	const tickerSymbols = useMemo(
		() => baseInstruments.map((instrument) => instrument.symbol).join("/"),
		[baseInstruments],
	);
	const sourceFilters = useMemo(() => {
		const sources = new Map<string, Source>();

		for (const signal of webhookSignals) {
			const source = createSourceFilterFromSignal(signal);
			const existingSource = sources.get(source.id);
			sources.set(source.id, {
				...source,
				avatar: existingSource?.avatar ?? source.avatar,
				handle: existingSource?.handle || source.handle,
			});
		}

		return Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [webhookSignals]);

	useEffect(() => {
		let isMounted = true;

		async function loadWebhookSignals() {
			try {
				const response = await fetch("/api/signals", {
					cache: "no-store",
				});

				if (!response.ok) {
					return;
				}

				const data = (await response.json()) as SignalsListResponse;

				if (isMounted) {
					setWebhookSignals(
						data.signals.filter((signal) => !isBlockedSignalTrader(signal.source)),
					);
				}
			} catch {
				// Keep the static demo data visible if the local API is temporarily unavailable.
			}
		}

		void loadWebhookSignals();
		const eventSource = new EventSource("/api/signals/events");

		eventSource.addEventListener("signal", (event) => {
			try {
				const signal = JSON.parse((event as MessageEvent<string>).data) as StoredSignal;

				if (isMounted) {
					setWebhookSignals((currentSignals) =>
						upsertWebhookSignal(currentSignals, signal),
					);
				}
			} catch {
				// Ignore malformed local dev events and keep the current view intact.
			}
		});

		return () => {
			isMounted = false;
			eventSource.close();
		};
	}, []);

	useEffect(() => {
		let isMounted = true;
		const controller = new AbortController();

		async function loadKlines() {
			try {
				const params = new URLSearchParams({
					interval: selectedTimeframe,
					limit: "180",
					symbol: selectedSymbol,
				});
				const response = await fetch(`/api/signals/klines?${params.toString()}`, {
					cache: "no-store",
					signal: controller.signal,
				});

				if (!response.ok) {
					if (isMounted) {
						setBinanceCandles([]);
					}
					return;
				}

				const data = (await response.json()) as SignalKlinesResponse;

				if (isMounted) {
					setBinanceCandles(
						data.klines.map((kline) => ({
							close: kline.close,
							high: kline.high,
							low: kline.low,
							open: kline.open,
							time: kline.time as UTCTimestamp,
						})),
					);
				}
			} catch (error) {
				if (!controller.signal.aborted && isMounted) {
					setBinanceCandles([]);
				}
			}
		}

		void loadKlines();

		return () => {
			isMounted = false;
			controller.abort();
		};
	}, [selectedSymbol, selectedTimeframe]);

	useEffect(() => {
		if (!instruments.length) {
			return;
		}

		if (!instruments.some((instrument) => instrument.symbol === selectedSymbol)) {
			setSelectedSymbol(instruments[0]?.symbol ?? "BTCUSDT");
			setActiveSignalId(null);
		}
	}, [instruments, selectedSymbol]);

	useEffect(() => {
		const visibleSourceIds = new Set(sourceFilters.map((source) => source.id));
		const nextSelectedSourceIds = selectedSourceIds.filter((sourceId) =>
			visibleSourceIds.has(sourceId),
		);

		if (nextSelectedSourceIds.length !== selectedSourceIds.length) {
			setSelectedSourceIds(nextSelectedSourceIds);
		}
	}, [selectedSourceIds, sourceFilters]);

	useEffect(() => {
		const timers = instruments
			.filter((instrument) => instrument.tickDirection)
			.map((instrument) =>
				window.setTimeout(() => {
					setInstrumentQuotes((currentQuotes) => ({
						...currentQuotes,
						[instrument.symbol]: {
							...currentQuotes[instrument.symbol],
							tickDirection: undefined,
						},
					}));
				}, TICK_FLASH_MS),
			);

		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, [instruments]);

	useEffect(() => {
		if (!tickerSymbols) {
			return;
		}

		const instrumentBySymbol = new Map(
			baseInstruments.map((instrument) => [instrument.symbol, instrument]),
		);
		const streams = tickerSymbols
			.split("/")
			.map((symbol) => `${symbol.toLowerCase()}@ticker`)
			.join("/");
		const disconnect = connectBinanceSocket(
			`${BINANCE_STREAM_BASE_URL}/stream?streams=${streams}`,
			(eventData) => {
				const ticker = parseTickerPayload(eventData);

				if (!ticker) {
					return;
				}

				const currentInstrument = instrumentBySymbol.get(ticker.symbol);

				if (!currentInstrument) {
					return;
				}

				setInstrumentQuotes((currentQuotes) => {
					const previousPrice = currentQuotes[ticker.symbol]?.price ?? currentInstrument.price;
					const tickDirection =
						ticker.price > previousPrice
							? "up"
							: ticker.price < previousPrice
								? "down"
								: currentQuotes[ticker.symbol]?.tickDirection;

					return {
						...currentQuotes,
						[ticker.symbol]: {
							change: ticker.change,
							price: ticker.price,
							tickDirection,
							volume: ticker.volume ?? currentInstrument.volume,
						},
					};
				});
			},
		);

		return disconnect;
	}, [baseInstruments, tickerSymbols]);

	useEffect(() => {
		const disconnect = connectBinanceSocket(
			`${BINANCE_STREAM_BASE_URL}/ws/${selectedSymbol.toLowerCase()}@kline_${selectedTimeframe}`,
			(eventData) => {
				const candle = parseKlinePayload(eventData);

				if (!candle) {
					return;
				}

				setBinanceCandles((currentCandles) => upsertCandle(currentCandles, candle));
			},
		);

		return disconnect;
	}, [selectedSymbol, selectedTimeframe]);

	const filteredSignals = useMemo(
		() =>
			signals.filter((signal) => {
				return (
					signal.symbol === selectedSymbol &&
					signal.status === selectedStatus &&
					matchesSelectedSources(signal, selectedSourceIds) &&
					(selectedDirection === "all" || signal.direction === selectedDirection) &&
					(selectedEntryStatus === "all" || signal.entryStatus === selectedEntryStatus)
				);
			}),
		[
			selectedDirection,
			selectedEntryStatus,
			selectedSourceIds,
			selectedStatus,
			selectedSymbol,
			signals,
		],
	);

	const statusCounts = useMemo(
		() =>
			Object.fromEntries(
				SIGNAL_STATUSES.map((status) => [
					status,
					signals.filter(
						(signal) =>
							signal.symbol === selectedSymbol &&
							signal.status === status &&
							matchesSelectedSources(signal, selectedSourceIds) &&
							(selectedDirection === "all" ||
								signal.direction === selectedDirection) &&
							(selectedEntryStatus === "all" ||
								signal.entryStatus === selectedEntryStatus),
					).length,
				]),
			) as Record<SignalStatus, number>,
		[selectedDirection, selectedEntryStatus, selectedSourceIds, selectedSymbol, signals],
	);

	const activeSignal = getSelectedSignal(filteredSignals, activeSignalId);

	const chartSignals = useMemo(
		() =>
			signals.filter(
				(signal) =>
					signal.symbol === selectedSymbol &&
					signal.status === "active" &&
					matchesSelectedSources(signal, selectedSourceIds) &&
					(selectedDirection === "all" || signal.direction === selectedDirection) &&
					(selectedEntryStatus === "all" || signal.entryStatus === selectedEntryStatus),
			),
		[selectedDirection, selectedEntryStatus, selectedSourceIds, selectedSymbol, signals],
	);

	const candles = useMemo(
		() =>
			binanceCandles.length
				? binanceCandles
				: buildFallbackCandles(selectedSymbol, selectedTimeframe),
		[binanceCandles, selectedSymbol, selectedTimeframe],
	);

	const selectedInstrument =
		instruments.find((instrument) => instrument.symbol === selectedSymbol) ??
		instruments[0] ??
		INSTRUMENTS[0];
	function formatPrice(value: number, fractionDigits = selectedInstrument.pricePrecision ?? 0) {
		return new Intl.NumberFormat(locale, {
			maximumFractionDigits: fractionDigits,
			minimumFractionDigits: fractionDigits,
		}).format(value);
	}

	function focusSignal(signal: SignalChartSignal) {
		setActiveSignalId(signal.id);
	}

	function selectSymbol(symbol: string) {
		setSelectedSymbol(symbol);
		const nextSignal = signals.find(
			(signal) =>
				signal.symbol === symbol &&
				signal.status === selectedStatus &&
				matchesSelectedSources(signal, selectedSourceIds) &&
				(selectedDirection === "all" || signal.direction === selectedDirection) &&
				(selectedEntryStatus === "all" || signal.entryStatus === selectedEntryStatus),
		);
		setActiveSignalId(nextSignal?.id ?? null);
	}

	function toggleSourceFilter(sourceId: string) {
		setSelectedSourceIds((currentSourceIds) =>
			currentSourceIds.includes(sourceId)
				? currentSourceIds.filter((currentSourceId) => currentSourceId !== sourceId)
				: [...currentSourceIds, sourceId],
		);
		setActiveSignalId(null);
	}

	function clearSourceFilters() {
		setSelectedSourceIds([]);
		setActiveSignalId(null);
	}

	return (
		<div className="min-h-full bg-[#141414] text-foreground">
			<header className="px-4 py-2 backdrop-blur border-b bg-[#141414]/80">
				<div className="min-w-0 gap-3 no-scrollbar flex items-center overflow-x-auto">
					<div className="gap-2 pr-3 text-sm font-semibold flex shrink-0 items-center">
						<RadioIcon className="size-4 text-emerald-500" />
						<span>{t("ticker.live")}</span>
					</div>
						{instruments.map((instrument) => (
							<button
								key={instrument.symbol}
								type="button"
								onClick={() => selectSymbol(instrument.symbol)}
								className={cn(
									"gap-2 px-3 py-1.5 text-sm hover:bg-white/8 flex shrink-0 items-center rounded-md border text-left transition-colors duration-200",
									selectedSymbol === instrument.symbol
										? "bg-white/8 border-foreground/20"
										: "border-transparent bg-transparent",
								)}
							>
								<span className="size-5 bg-black text-[10px] font-bold flex shrink-0 items-center justify-center overflow-hidden rounded-full">
									{instrument.logo ? (
										<img
											alt={instrument.base}
											className="size-6 object-contain"
											src={instrument.logo}
										/>
									) : (
										instrument.base.slice(0, 2)
									)}
								</span>
								<span className="font-semibold">{instrument.base}</span>
								<span
									className={cn(
										"font-mono text-muted-foreground transition-colors duration-200",
										instrument.tickDirection === "up" && "text-emerald-400",
										instrument.tickDirection === "down" && "text-rose-400",
									)}
								>
									{instrument.price > 0
										? `$${formatPrice(instrument.price, instrument.pricePrecision ?? 0)}`
										: "--"}
								</span>
							<span
								className={cn(
									"font-mono text-xs",
									instrument.change >= 0 ? "text-emerald-500" : "text-rose-500",
								)}
							>
								{instrument.change >= 0 ? "+" : ""}
								{instrument.change.toFixed(2)}%
							</span>
						</button>
					))}
				</div>
			</header>

			<div
				className={cn(
					"gap-0 lg:min-h-[760px] xl:h-[calc(100vh-121px)] grid grid-cols-1",
					isSignalPanelCollapsed
						? "xl:grid-cols-[minmax(700px,1fr)_0px]"
						: "xl:grid-cols-[minmax(700px,1fr)_328px]",
				)}
			>
				<aside className="xl:border-r xl:border-b-0 hidden border-b bg-[#141414]">
					<div className="px-4 py-4 flex items-center justify-between border-b">
						<div>
							<p className="text-xs text-muted-foreground">{t("market.eyebrow")}</p>
							<h2 className="text-lg font-semibold">{t("market.title")}</h2>
						</div>
						<Button size="icon" variant="ghost" aria-label={t("market.search")}>
							<SearchIcon className="size-4" />
						</Button>
					</div>

					<div className="divide-y">
						{instruments.map((instrument) => {
							const isSelected = instrument.symbol === selectedSymbol;

							return (
								<div
									key={instrument.symbol}
									className={cn(
										"group gap-3 px-4 py-4 flex items-center transition-colors",
										isSelected ? "bg-white/8" : "hover:bg-white/5",
									)}
								>
									<button
										type="button"
										onClick={() => selectSymbol(instrument.symbol)}
										className="min-w-0 gap-3 flex flex-1 items-center text-left"
									>
										<span
											className={cn(
												"size-9 text-sm font-bold text-white flex shrink-0 items-center justify-center rounded-full",
												instrument.accent,
											)}
										>
											{instrument.base.slice(0, 1)}
										</span>
										<span className="min-w-0">
											<span className="font-semibold block truncate">
												{instrument.symbol}
											</span>
											<span className="font-mono text-xs text-muted-foreground">
												{instrument.volume}
											</span>
										</span>
									</button>
									<div className="text-right">
										<p className="font-mono text-sm font-semibold">
											$
											{formatPrice(
												instrument.price,
												instrument.symbol === "SOLUSDT" ? 2 : 0,
											)}
										</p>
										<p
											className={cn(
												"font-mono text-xs",
												instrument.change >= 0
													? "text-emerald-500"
													: "text-rose-500",
											)}
										>
											{instrument.change >= 0 ? "+" : ""}
											{instrument.change.toFixed(2)}%
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</aside>

				<main className="min-w-0 flex flex-col bg-[#141414]">
					<section className="px-3 py-3 border-b bg-[#141414]">
						<div className="gap-3 flex flex-col">
							<div className="no-scrollbar -mx-3 min-w-0 gap-2 px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 flex flex-nowrap items-center overflow-x-auto">
								<button
									type="button"
									onClick={clearSourceFilters}
									className={cn(
										"px-2.5 py-1.5 text-xs font-medium min-w-[52px] shrink-0 rounded-md border text-center transition-colors",
										selectedSourceIds.length === 0
											? "border-foreground/20 bg-foreground text-background"
											: "hover:bg-white/8 bg-[#141414]",
									)}
								>
									{t("filters.allSources")}
								</button>
								{sourceFilters.map((source) => (
									<button
										key={source.id}
										type="button"
										onClick={() => toggleSourceFilter(source.id)}
										className={cn(
											"gap-1.5 px-2 py-1 text-xs flex shrink-0 items-center rounded-md border transition-colors",
											selectedSourceIds.includes(source.id)
												? "border-foreground/20 bg-foreground text-background"
												: "hover:bg-white/8 bg-[#141414]",
										)}
										aria-pressed={selectedSourceIds.includes(source.id)}
									>
										<span className="size-5 flex shrink-0 items-center justify-center overflow-hidden rounded-full">
											<img
												alt={source.name}
												className="size-5 object-cover"
												src={source.avatar}
											/>
										</span>
										<span className="max-w-32 truncate">{source.name}</span>
									</button>
								))}
							</div>

							<div className="gap-2 flex flex-wrap items-center">
								{SIGNAL_DIRECTIONS.map((direction) => (
									<button
										key={direction}
										type="button"
										onClick={() => setSelectedDirection(direction)}
										className={cn(
											"gap-1 px-2.5 py-1.5 text-xs font-semibold flex min-w-[52px] items-center justify-center rounded-md border transition-colors",
											selectedDirection === direction
												? "border-foreground/20 bg-foreground text-background"
												: "hover:bg-white/8 border-transparent bg-[#141414] text-muted-foreground hover:text-foreground",
										)}
									>
										{direction === "long" && (
											<TrendingUpIcon className="size-3.5" />
										)}
										{direction === "short" && (
											<TrendingDownIcon className="size-3.5" />
										)}
										{t(`direction.${direction}`)}
									</button>
								))}

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className="gap-1.5 px-2.5 py-1.5 text-xs font-medium hover:text-white flex items-center rounded-md border bg-[#141414] text-muted-foreground transition-colors"
										>
											{selectedTimeRange === "all"
												? "信号时间"
												: selectedTimeRange === "24h"
													? "24小时内"
													: selectedTimeRange === "3d"
														? "3天内"
														: selectedTimeRange === "7d"
															? "7天内"
															: "30天内"}
											<ChevronDownIcon className="size-3" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="border-white/10 text-white min-w-[120px] bg-[#1a1a1a]"
									>
										{TIME_RANGES.map((range) => (
											<DropdownMenuItem
												key={range}
												className="gap-2 text-xs cursor-pointer"
												onClick={() => setSelectedTimeRange(range)}
											>
												<CheckIcon
													className={cn(
														"size-3.5",
														selectedTimeRange === range
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												{range === "all"
													? "信号时间"
													: range === "24h"
														? "24小时内"
														: range === "3d"
															? "3天内"
															: range === "7d"
																? "7天内"
																: "30天内"}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>

								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className="gap-1.5 px-2.5 py-1.5 text-xs font-medium hover:text-white flex items-center rounded-md border bg-[#141414] text-muted-foreground transition-colors"
										>
											{selectedEntryStatus === "all"
												? "入场状态"
												: selectedEntryStatus === "pending"
													? "待入场"
													: "已入场"}
											<ChevronDownIcon className="size-3" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="border-white/10 text-white min-w-[110px] bg-[#1a1a1a]"
									>
										{ENTRY_STATUSES.map((es) => (
											<DropdownMenuItem
												key={es}
												className="gap-2 text-xs cursor-pointer"
												onClick={() => setSelectedEntryStatus(es)}
											>
												<CheckIcon
													className={cn(
														"size-3.5",
														selectedEntryStatus === es
															? "opacity-100"
															: "opacity-0",
													)}
												/>
												{es === "all"
													? "入场状态"
													: es === "pending"
														? "待入场"
														: "已入场"}
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>

								<Button
									size="icon"
									variant="ghost"
									aria-label={t("actions.refresh")}
								>
									<RefreshCwIcon className="size-4" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={t("actions.filters")}
								>
									<SlidersHorizontalIcon className="size-4" />
								</Button>
							</div>
						</div>
					</section>

					<section className="xl:min-h-0 xl:flex-1 flex flex-col">
						<div className="px-4 py-3 flex items-center justify-between border-b bg-[#141414]">
							<div className="gap-3 flex items-center">
								<ChartCandlestickIcon className="size-4 text-muted-foreground" />
								<span className="font-mono text-sm font-semibold">
									{selectedSymbol}
								</span>
							</div>
							<div className="gap-2 flex items-center">
								<div className="gap-0.5 p-0.5 flex items-center rounded-md border bg-[#141414]">
									{SUPPORTED_TIMEFRAMES.map((timeframe) => (
										<button
											key={timeframe}
											type="button"
											onClick={() => setSelectedTimeframe(timeframe)}
											className={cn(
												"px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors",
												selectedTimeframe === timeframe
													? "bg-foreground text-background"
													: "hover:bg-white/8 text-muted-foreground hover:text-foreground",
											)}
										>
											{timeframe}
										</button>
									))}
								</div>
								<Button size="icon" variant="ghost" aria-label={t("actions.alert")}>
									<BellIcon className="size-4" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={t("actions.expand")}
								>
									<Maximize2Icon className="size-4" />
								</Button>
							</div>
						</div>

						<div className="xl:min-h-0 xl:flex-1 h-[620px]">
							<TradingViewSignalChart
								activeSignal={activeSignal}
								candles={candles}
								className="h-full"
								formatPrice={formatPrice}
								labels={{
									entry: t("chart.entry"),
									stopLoss: t("chart.stopLoss"),
									takeProfit: t("chart.takeProfit"),
								}}
								locale={locale}
								onSelectSignal={focusSignal}
								signals={chartSignals}
								symbol={selectedSymbol}
								timeframe={selectedTimeframe}
							/>
						</div>
					</section>
				</main>

				<aside
					className={cn("group xl:border-l xl:border-t-0 relative border-t bg-[#141414]")}
				>
					<button
						type="button"
						onClick={() => setIsSignalPanelCollapsed((current) => !current)}
						className={cn(
							"left-0 top-3 size-8 border-white/10 hover:border-white/20 hover:text-white xl:flex backdrop-blur absolute z-40 hidden -translate-x-1/2 items-center justify-center rounded-full border bg-[#1f1f1f]/95 text-muted-foreground shadow-[0_10px_32px_rgba(0,0,0,0.35)] transition-all hover:bg-[#272727] focus-visible:opacity-100",
							isSignalPanelCollapsed
								? "opacity-100"
								: "opacity-0 group-hover:opacity-100",
						)}
						aria-label={isSignalPanelCollapsed ? "展开信号面板" : "收起信号面板"}
						aria-expanded={!isSignalPanelCollapsed}
					>
						{isSignalPanelCollapsed ? (
							<ChevronLeftIcon className="size-4" />
						) : (
							<ChevronRightIcon className="size-4" />
						)}
					</button>

					<div className={cn("border-b", isSignalPanelCollapsed && "xl:hidden")}>
						<div
							className={cn(
								"min-w-0 grid grid-cols-2",
								isSignalPanelCollapsed && "xl:hidden",
							)}
						>
							{SIGNAL_STATUSES.map((status) => (
								<button
									key={status}
									type="button"
									onClick={() => {
										setSelectedStatus(status);
										const nextSignal = signals.find(
											(signal) =>
												signal.symbol === selectedSymbol &&
												signal.status === status &&
												matchesSelectedSources(signal, selectedSourceIds) &&
												(selectedDirection === "all" ||
													signal.direction === selectedDirection) &&
												(selectedEntryStatus === "all" ||
													signal.entryStatus === selectedEntryStatus),
										);
										setActiveSignalId(nextSignal?.id ?? null);
									}}
									className={cn(
										"px-4 py-3 text-xs font-medium border-b-2 transition-colors",
										selectedStatus === status
											? "border-white text-white bg-[#222222]"
											: "hover:text-white border-transparent bg-transparent text-muted-foreground",
									)}
								>
									<span>{t(`status.${status}`)}</span>
									{statusCounts[status] > 0 && (
										<span className="ml-1.5 text-xs font-semibold opacity-60">
											{statusCounts[status]}
										</span>
									)}
								</button>
							))}
						</div>
					</div>

					<div
						className={cn(
							"space-y-3 p-3 xl:max-h-[680px] xl:overflow-y-auto",
							isSignalPanelCollapsed && "xl:hidden",
						)}
					>
						{filteredSignals.length ? (
							filteredSignals.map((signal) => {
								const statusPresentation = getSignalStatusPresentation(signal, {
									closed: t("signalsPanel.closed"),
									entered: t("signalsPanel.entered"),
									expectedRr: t("signalsPanel.expectedRr"),
									pending: t("signalsPanel.pending"),
									result: t("signalsPanel.result"),
								});
								const StatusIcon = statusPresentation.icon;

								return (
									<button
										key={signal.id}
										type="button"
										onClick={() => focusSignal(signal)}
										className={cn(
											"p-3 border-white/5 hover:bg-white/5 w-full rounded-xl border bg-[#141414] text-left transition-colors",
											signal.id === activeSignal?.id &&
												"border-white/10 bg-white/5",
										)}
									>
										<div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
											<div className="min-w-0 gap-2 flex items-center">
												<span className="size-8 flex shrink-0 items-center justify-center overflow-hidden rounded-full">
													<img
														alt={signal.sourceName}
														className="size-8 object-cover"
														src={signal.avatarUrl}
													/>
												</span>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-semibold truncate">
													{signal.sourceName}
												</p>
												<p className="text-xs truncate text-muted-foreground">
													{selectedInstrument.symbol} ·{" "}
													{t(`direction.${signal.direction}`)}
												</p>
											</div>
										</div>
										<span
											className={cn(
												"max-w-[72px] px-2 py-1 text-center font-semibold leading-tight rounded-full border text-[11px]",
												statusPresentation.badgeClassName,
											)}
										>
											{statusPresentation.label}
										</span>
									</div>

									<div className="gap-3 text-xs grid grid-cols-2">
										<SignalMetric
											label={t("signalsPanel.entry")}
											value={formatPrice(signal.entry)}
										/>
										<SignalMetric
											label={t("signalsPanel.submittedAt")}
											value={signal.submittedAt}
										/>
										<SignalMetric
											label={t("signalsPanel.takeProfit")}
											value={formatPrice(signal.takeProfit)}
											tone="profit"
										/>
										<SignalMetric
											label={t("signalsPanel.stopLoss")}
											value={formatPrice(signal.stopLoss)}
											tone="risk"
										/>
									</div>

									<div className="mt-3 px-3 py-2 text-xs flex items-center justify-between rounded-md bg-[#141414]">
										<span className="gap-1 flex items-center text-muted-foreground">
											<StatusIcon
												className={cn(
													"size-3.5",
													statusPresentation.resultIconClassName,
												)}
											/>
											{statusPresentation.resultLabel}
										</span>
										<span
											className={cn(
												"font-mono font-semibold",
												statusPresentation.resultValueClassName,
											)}
										>
											{signal.status === "active"
												? signal.confidence.toFixed(2)
												: statusPresentation.label}
										</span>
									</div>
								</button>
								);
							})
						) : (
							<div className="p-6 rounded-md border border-dashed text-center">
								<p className="font-medium">{t("signalsPanel.emptyTitle")}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{t("signalsPanel.emptyDescription")}
								</p>
							</div>
						)}
					</div>
				</aside>
			</div>
		</div>
	);
}

interface SignalMetricProps {
	label: string;
	value: string;
	tone?: "profit" | "risk";
}

function SignalMetric({ label, value, tone }: SignalMetricProps) {
	return (
		<div>
			<p className="mb-1 text-muted-foreground">{label}</p>
			<p
				className={cn(
					"font-mono font-semibold",
					tone === "profit" && "text-emerald-500",
					tone === "risk" && "text-rose-500",
				)}
			>
				{value}
			</p>
		</div>
	);
}
