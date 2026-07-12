"use client";

import { usePurchases } from "@payments/hooks/purchases";
import { Button, cn } from "@repo/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { UTCTimestamp } from "lightweight-charts";
import {
	ChartCandlestickIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	Clock3Icon,
	CompassIcon,
	CrownIcon,
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
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { isBlockedSignalTrader } from "../lib/signal-identity";
import type {
	SignalKlinesResponse,
	SignalsListResponse,
	StoredSignal,
	StoredTradingSymbol,
} from "../lib/signal-types";
import type { SignalChartSignal } from "./TradingViewSignalChart";
import { TradingViewSignalChart } from "./TradingViewSignalChart";

const SUPPORTED_TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
const SIGNAL_DIRECTIONS = ["all", "long", "short"] as const;
const SIGNAL_STATUSES = ["active", "history"] as const;
const TIME_RANGES = ["all", "24h", "3d", "7d", "30d"] as const;
const ENTRY_STATUSES = ["all", "pending", "entered"] as const;
const SIGNALS_GUIDE_STORAGE_KEY_PREFIX = "signalfast:signals-guide:v2";
const TRIAL_WELCOME_CONFETTI_STYLES = `
@keyframes trial-confetti-fall {
	0% {
		opacity: 0;
		transform: translate3d(var(--confetti-x-start), -10px, 0) scale(0.72) rotate(0deg);
	}
	18% {
		opacity: 1;
	}
	100% {
		opacity: 0;
		transform: translate3d(var(--confetti-x-end), 34px, 0) scale(1) rotate(150deg);
	}
}

.trial-confetti-particle {
	animation: trial-confetti-fall 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
	.trial-confetti-particle {
		animation: none;
		opacity: 0.65;
	}
}
`;
const SIGNALS_SKELETON_STYLES = `
@keyframes signals-skeleton-shimmer {
	100% {
		transform: translateX(100%);
	}
}

.signals-skeleton-shimmer {
	animation: signals-skeleton-shimmer 1.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@media (prefers-reduced-motion: reduce) {
	.signals-skeleton-shimmer {
		animation: none;
		opacity: 0.45;
	}
}
`;

type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];
type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];
type SignalStatus = (typeof SIGNAL_STATUSES)[number];
type TimeRange = (typeof TIME_RANGES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];
type SignalsGuideTarget = "chart" | "filters" | "signalList" | "ticker" | "traders";

interface TrialConfettiStyle extends CSSProperties {
	"--confetti-x-end": string;
	"--confetti-x-start": string;
}

interface TrialConfettiParticle {
	className: string;
	style: TrialConfettiStyle;
}

const TRIAL_WELCOME_CONFETTI_PARTICLES: TrialConfettiParticle[] = [
	{
		className: "size-1.5 rounded-full",
		style: {
			"--confetti-x-end": "-18px",
			"--confetti-x-start": "-4px",
			animationDelay: "0ms",
			animationDuration: "2.7s",
			backgroundColor: "#facc15",
			left: "38%",
			top: "10%",
		},
	},
	{
		className: "h-1.5 w-1 rounded-[2px]",
		style: {
			"--confetti-x-end": "18px",
			"--confetti-x-start": "4px",
			animationDelay: "180ms",
			animationDuration: "3s",
			backgroundColor: "#38bdf8",
			left: "58%",
			top: "7%",
		},
	},
	{
		className: "size-1 rounded-full",
		style: {
			"--confetti-x-end": "-10px",
			"--confetti-x-start": "8px",
			animationDelay: "420ms",
			animationDuration: "2.5s",
			backgroundColor: "#fb7185",
			left: "47%",
			top: "2%",
		},
	},
	{
		className: "h-1 w-2 rounded-[2px]",
		style: {
			"--confetti-x-end": "12px",
			"--confetti-x-start": "-10px",
			animationDelay: "620ms",
			animationDuration: "3.1s",
			backgroundColor: "#34d399",
			left: "32%",
			top: "28%",
		},
	},
	{
		className: "size-1.5 rounded-full",
		style: {
			"--confetti-x-end": "16px",
			"--confetti-x-start": "-6px",
			animationDelay: "840ms",
			animationDuration: "2.9s",
			backgroundColor: "#a78bfa",
			left: "64%",
			top: "26%",
		},
	},
	{
		className: "h-1.5 w-1 rounded-[2px]",
		style: {
			"--confetti-x-end": "-14px",
			"--confetti-x-start": "5px",
			animationDelay: "1120ms",
			animationDuration: "2.6s",
			backgroundColor: "#f97316",
			left: "52%",
			top: "18%",
		},
	},
];

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
	takeProfit?: number;
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

interface SignalsGuideStep {
	icon: LucideIcon;
	target: SignalsGuideTarget;
	title: string;
	description: string;
}

interface GuideTargetRect {
	bottom: number;
	height: number;
	left: number;
	right: number;
	top: number;
	width: number;
}

interface GuideViewportSize {
	height: number;
	width: number;
}

interface SymbolCandles {
	candles: Candle[];
	symbol: string;
	timeframe: Timeframe;
}

interface SignalPageFilters {
	direction: SignalDirection;
	entryStatus: EntryStatus;
	sourceIds: string[];
	status: SignalStatus;
	submittedAfter: Date | null;
	symbol: string;
}

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
const MIN_CHART_CANDLES = 20;
const PRIORITY_SYMBOL_BASES = ["BTC", "ETH", "SOL"] as const;
const SIGNAL_PAGE_SIZE = 20;
const TICK_FLASH_MS = 700;
const TICKER_SKELETON_WIDTHS = ["w-36", "w-32", "w-[8.5rem]", "w-[7.5rem]", "w-28"] as const;
const CHART_SKELETON_BARS = [
	32, 48, 38, 54, 44, 62, 51, 68, 57, 72, 64, 58, 76, 69, 61, 80, 73, 66, 71, 59, 63, 55, 49, 43,
	52, 46, 58, 67, 74, 69, 78, 83, 72, 65, 70, 62, 57, 51, 44, 39, 47, 53, 60, 56, 64, 71, 76, 68,
	61, 55, 49, 58, 66, 73, 69, 77, 82, 74, 67, 60,
] as const;

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

function getPrecisionForPrice(value: number) {
	if (!Number.isFinite(value) || value <= 0) {
		return 0;
	}

	if (value >= 100) {
		return 0;
	}

	if (value >= 1) {
		return 2;
	}

	return Math.min(8, Math.max(2, Math.ceil(Math.abs(Math.log10(value))) + 2));
}

function isPositiveFiniteNumber(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getChartPricePrecision(
	candles: Candle[],
	signals: TradeSignal[],
	fallbackPrecision: number,
) {
	const prices = [
		...candles.flatMap((candle) => [candle.open, candle.high, candle.low, candle.close]),
		...signals.flatMap((signal) => [signal.entry, signal.takeProfit, signal.stopLoss]),
	].filter(isPositiveFiniteNumber);

	if (!prices.length) {
		return fallbackPrecision;
	}

	return Math.max(fallbackPrecision, ...prices.map(getPrecisionForPrice));
}

function getSymbolBase(symbol: string) {
	const quoteAssets = ["USDT", "USDC", "USD", "BTC", "ETH"];
	const quoteAsset = quoteAssets.find((quote) => symbol.endsWith(quote));

	return quoteAsset ? symbol.slice(0, -quoteAsset.length) : symbol;
}

function getPrioritySymbolRank(instrument: Pick<Instrument, "base" | "symbol">) {
	const base = instrument.base || getSymbolBase(instrument.symbol);
	const priorityIndex = PRIORITY_SYMBOL_BASES.indexOf(
		base as (typeof PRIORITY_SYMBOL_BASES)[number],
	);

	return priorityIndex === -1 ? PRIORITY_SYMBOL_BASES.length : priorityIndex;
}

function sortInstrumentsByPriority(left: Instrument, right: Instrument) {
	const leftRank = getPrioritySymbolRank(left);
	const rightRank = getPrioritySymbolRank(right);

	if (leftRank !== rightRank) {
		return leftRank - rightRank;
	}

	return left.symbol.localeCompare(right.symbol);
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

function isBinanceTradingSymbol(symbol: StoredTradingSymbol) {
	return symbol.exchange.trim().toLowerCase() === "binance";
}

async function canDisplaySymbolChart(symbol: string, signal?: AbortSignal) {
	try {
		const params = new URLSearchParams({
			interval: "1h",
			limit: String(MIN_CHART_CANDLES),
			symbol,
		});
		const response = await fetch(`/api/signals/klines?${params.toString()}`, {
			cache: "no-store",
			signal,
		});

		if (!response.ok) {
			return false;
		}

		const data = (await response.json()) as SignalKlinesResponse;

		return data.klines.length >= MIN_CHART_CANDLES;
	} catch {
		return false;
	}
}

function createSourceFilterFromSignal(signal: StoredSignal): Source {
	const name = signal.source.name;
	const id = signal.source.id ?? normalizeSourceKey(name);

	return {
		accent: getSymbolAccent(id),
		avatar: signal.source.avatarUrl ?? getGeneratedSvgDataUrl(id, name, "trader"),
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
		sourceId: signal.source.id ?? normalizeSourceKey(signal.source.name),
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

function matchesSelectedSources(
	signal: Pick<TradeSignal, "sourceId">,
	selectedSourceIds: string[],
) {
	return selectedSourceIds.length === 0 || selectedSourceIds.includes(signal.sourceId);
}

function getSubmittedAfterForTimeRange(timeRange: TimeRange) {
	if (timeRange === "all") {
		return null;
	}

	const daysByRange: Record<Exclude<TimeRange, "all">, number> = {
		"24h": 1,
		"3d": 3,
		"7d": 7,
		"30d": 30,
	};

	return new Date(Date.now() - daysByRange[timeRange] * 24 * 60 * 60 * 1000);
}

function doesStoredSignalMatchPageFilters(signal: StoredSignal, filters: SignalPageFilters) {
	if (filters.symbol && signal.symbol !== filters.symbol) {
		return false;
	}

	if (signal.status !== filters.status) {
		return false;
	}

	if (filters.sourceIds.length > 0) {
		const sourceId = signal.source.id ?? normalizeSourceKey(signal.source.name);

		if (!filters.sourceIds.includes(sourceId)) {
			return false;
		}
	}

	if (filters.direction !== "all" && signal.direction !== filters.direction) {
		return false;
	}

	if (filters.entryStatus !== "all" && signal.entryStatus !== filters.entryStatus) {
		return false;
	}

	if (filters.submittedAfter) {
		const submittedAt = new Date(signal.submittedAt);

		if (Number.isNaN(submittedAt.getTime()) || submittedAt < filters.submittedAfter) {
			return false;
		}
	}

	return true;
}

function getSignalPageSearchParams(filters: SignalPageFilters, cursor?: string | null) {
	const params = new URLSearchParams({
		limit: String(SIGNAL_PAGE_SIZE),
		status: filters.status,
	});

	if (cursor) {
		params.set("cursor", cursor);
	}

	if (filters.direction !== "all") {
		params.set("direction", filters.direction);
	}

	if (filters.entryStatus !== "all") {
		params.set("entryStatus", filters.entryStatus);
	}

	if (filters.sourceIds.length > 0) {
		params.set("sourceIds", filters.sourceIds.join(","));
	}

	if (filters.submittedAfter) {
		params.set("submittedAfter", filters.submittedAfter.toISOString());
	}

	if (filters.symbol) {
		params.set("symbol", filters.symbol);
	}

	return params;
}

function clampNumber(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getGuideTargetRect(element: HTMLElement): GuideTargetRect {
	const rect = element.getBoundingClientRect();
	const padding = 8;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const left = clampNumber(rect.left - padding, 12, viewportWidth - 24);
	const top = clampNumber(rect.top - padding, 12, viewportHeight - 24);
	const right = clampNumber(rect.right + padding, left + 24, viewportWidth - 12);
	const bottom = clampNumber(rect.bottom + padding, top + 24, viewportHeight - 12);

	return {
		bottom,
		height: bottom - top,
		left,
		right,
		top,
		width: right - left,
	};
}

function getGuideCardStyle(
	targetRect: GuideTargetRect | null,
	viewportSize: GuideViewportSize,
): CSSProperties {
	if (!viewportSize.width || !viewportSize.height) {
		return {
			bottom: 24,
			left: "50%",
			maxWidth: 380,
			transform: "translateX(-50%)",
			width: "calc(100vw - 32px)",
		};
	}

	const viewportWidth = viewportSize.width;
	const viewportHeight = viewportSize.height;
	const cardWidth = Math.min(380, Math.max(240, viewportWidth - 32));
	const estimatedHeight = 260;
	const inset = 16;
	const gap = 16;
	const maxLeft = Math.max(inset, viewportWidth - cardWidth - inset);
	const maxTop = Math.max(inset, viewportHeight - estimatedHeight - inset);

	if (!targetRect) {
		return {
			bottom: 24,
			left: "50%",
			transform: "translateX(-50%)",
			width: cardWidth,
		};
	}

	const centeredLeft = clampNumber(
		targetRect.left + targetRect.width / 2 - cardWidth / 2,
		inset,
		maxLeft,
	);
	const belowTop = targetRect.bottom + gap;

	if (belowTop + estimatedHeight <= viewportHeight - inset) {
		return {
			left: centeredLeft,
			top: belowTop,
			width: cardWidth,
		};
	}

	const aboveTop = targetRect.top - gap - estimatedHeight;

	if (aboveTop >= inset) {
		return {
			left: centeredLeft,
			top: aboveTop,
			width: cardWidth,
		};
	}

	const sideTop = clampNumber(targetRect.top, inset, maxTop);

	if (targetRect.right + gap + cardWidth <= viewportWidth - inset) {
		return {
			left: targetRect.right + gap,
			top: sideTop,
			width: cardWidth,
		};
	}

	if (targetRect.left - gap - cardWidth >= inset) {
		return {
			left: targetRect.left - gap - cardWidth,
			top: sideTop,
			width: cardWidth,
		};
	}

	return {
		left: centeredLeft,
		top: clampNumber(targetRect.top + 18, inset, maxTop),
		width: cardWidth,
	};
}

export function SignalsWorkspace() {
	const t = useTranslations("signals");
	const locale = useLocale();
	const { activeEntitlementGrant, activePlan } = usePurchases();
	const [webhookSignals, setWebhookSignals] = useState<StoredSignal[]>([]);
	const [signalPageSignals, setSignalPageSignals] = useState<StoredSignal[]>([]);
	const [signalPageCursor, setSignalPageCursor] = useState<string | null>(null);
	const [statusCounts, setStatusCounts] = useState<Record<SignalStatus, number>>({
		active: 0,
		history: 0,
	});
	const [binanceCandles, setBinanceCandles] = useState<SymbolCandles | null>(null);
	const [instrumentQuotes, setInstrumentQuotes] = useState<Record<string, Partial<Instrument>>>(
		{},
	);
	const [selectedSymbol, setSelectedSymbol] = useState("");
	const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1h");
	const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
	const [selectedDirection, setSelectedDirection] = useState<SignalDirection>("all");
	const [selectedStatus, setSelectedStatus] = useState<SignalStatus>("active");
	const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("30d");
	const [selectedEntryStatus, setSelectedEntryStatus] = useState<EntryStatus>("all");
	const [activeSignalId, setActiveSignalId] = useState<string | null>(null);
	const [isSignalPanelCollapsed, setIsSignalPanelCollapsed] = useState(false);
	const [isChartFullscreenOpen, setIsChartFullscreenOpen] = useState(false);
	const [isSignalsLoading, setIsSignalsLoading] = useState(true);
	const [isSignalPageLoading, setIsSignalPageLoading] = useState(true);
	const [isSignalPageLoadingMore, setIsSignalPageLoadingMore] = useState(false);
	const [isKlinesLoading, setIsKlinesLoading] = useState(false);
	const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
	const [guideOpen, setGuideOpen] = useState(false);
	const [guideStepIndex, setGuideStepIndex] = useState(0);
	const activePlanEntitlement =
		activePlan && "expiresAt" in activePlan && activePlan.expiresAt
			? {
					expiresAt: activePlan.expiresAt,
					source:
						"source" in activePlan ? activePlan.source : activeEntitlementGrant?.source,
				}
			: null;
	const isSignupTrial = activePlanEntitlement?.source === "signup_trial";
	const guideStorageKey = isSignupTrial
		? `${SIGNALS_GUIDE_STORAGE_KEY_PREFIX}:${activeEntitlementGrant?.id ?? "current"}`
		: SIGNALS_GUIDE_STORAGE_KEY_PREFIX;
	const signalPageRequestIdRef = useRef(0);
	const [signalPageRefreshKey, setSignalPageRefreshKey] = useState(0);
	const [supportedSymbols, setSupportedSymbols] = useState<Set<string> | null>(null);
	const symbolAvailabilityRef = useRef(new Map<string, boolean>());

	const visibleWebhookSignals = useMemo(() => {
		if (!supportedSymbols) {
			return [];
		}

		return webhookSignals.filter((signal) => supportedSymbols.has(signal.symbol));
	}, [supportedSymbols, webhookSignals]);
	const visibleSignalPageSignals = useMemo(() => {
		if (!supportedSymbols) {
			return [];
		}

		return signalPageSignals.filter((signal) => supportedSymbols.has(signal.symbol));
	}, [signalPageSignals, supportedSymbols]);

	const signals = useMemo(
		() => visibleWebhookSignals.map((signal) => mapStoredSignalToTradeSignal(signal, locale)),
		[locale, visibleWebhookSignals],
	);
	const signalPageTradeSignals = useMemo(
		() =>
			visibleSignalPageSignals.map((signal) => mapStoredSignalToTradeSignal(signal, locale)),
		[locale, visibleSignalPageSignals],
	);
	const baseInstruments = useMemo(() => {
		const symbols = new Map<string, StoredTradingSymbol>();

		for (const signal of visibleWebhookSignals) {
			symbols.set(signal.tradingSymbol.symbol, signal.tradingSymbol);
		}

		return Array.from(symbols.values())
			.map(createInstrumentFromTradingSymbol)
			.sort(sortInstrumentsByPriority);
	}, [visibleWebhookSignals]);
	const instruments = useMemo(
		() =>
			baseInstruments
				.map((instrument) => ({
					...instrument,
					...instrumentQuotes[instrument.symbol],
				}))
				.sort(sortInstrumentsByPriority),
		[baseInstruments, instrumentQuotes],
	);
	const tickerSymbols = useMemo(
		() => baseInstruments.map((instrument) => instrument.symbol).join("/"),
		[baseInstruments],
	);
	const sourceFilters = useMemo(() => {
		const sources = new Map<string, Source>();

		for (const signal of visibleWebhookSignals) {
			const source = createSourceFilterFromSignal(signal);
			const existingSource = sources.get(source.id);
			sources.set(source.id, {
				...source,
				avatar: existingSource?.avatar ?? source.avatar,
				handle: existingSource?.handle || source.handle,
			});
		}

		return Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [visibleWebhookSignals]);
	const signalPageFilters = useMemo<SignalPageFilters>(
		() => ({
			direction: selectedDirection,
			entryStatus: selectedEntryStatus,
			sourceIds: selectedSourceIds,
			status: selectedStatus,
			submittedAfter: getSubmittedAfterForTimeRange(selectedTimeRange),
			symbol: selectedSymbol,
		}),
		[
			selectedDirection,
			selectedEntryStatus,
			selectedSourceIds,
			selectedStatus,
			selectedSymbol,
			selectedTimeRange,
		],
	);
	const signalPageFiltersRef = useRef(signalPageFilters);

	useEffect(() => {
		if (isSignalsLoading) {
			return;
		}

		const controller = new AbortController();
		const tradingSymbols = new Map<string, StoredTradingSymbol>();

		for (const signal of webhookSignals) {
			tradingSymbols.set(signal.symbol, signal.tradingSymbol);
		}

		for (const symbol of tradingSymbols.values()) {
			if (!isBinanceTradingSymbol(symbol)) {
				symbolAvailabilityRef.current.set(symbol.symbol, false);
			}
		}

		const symbolsToCheck = Array.from(tradingSymbols.values()).filter(
			(symbol) =>
				isBinanceTradingSymbol(symbol) && !symbolAvailabilityRef.current.has(symbol.symbol),
		);

		async function loadSymbolAvailability() {
			await Promise.all(
				symbolsToCheck.map(async (symbol) => {
					const canDisplay = await canDisplaySymbolChart(
						symbol.symbol,
						controller.signal,
					);

					if (!controller.signal.aborted) {
						symbolAvailabilityRef.current.set(symbol.symbol, canDisplay);
					}
				}),
			);

			if (controller.signal.aborted) {
				return;
			}

			setSupportedSymbols(
				new Set(
					Array.from(tradingSymbols.keys()).filter((symbol) =>
						symbolAvailabilityRef.current.get(symbol),
					),
				),
			);
		}

		void loadSymbolAvailability();

		return () => {
			controller.abort();
		};
	}, [isSignalsLoading, webhookSignals]);

	useEffect(() => {
		let isMounted = true;

		async function loadWebhookSignals() {
			try {
				const response = await fetch("/api/signals", {
					cache: "no-store",
				});

				if (!response.ok) {
					if (isMounted) {
						setIsSignalPageLoading(false);
						setIsSignalsLoading(false);
					}
					return;
				}

				const data = (await response.json()) as SignalsListResponse;

				if (isMounted) {
					const visibleSignals = data.signals.filter(
						(signal) => !isBlockedSignalTrader(signal.source),
					);
					setWebhookSignals(visibleSignals);
					setIsSignalsLoading(false);
				}
			} catch {
				if (isMounted) {
					setIsSignalsLoading(false);
				}
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
					setSignalPageSignals((currentSignals) => {
						const matchesCurrentPage = doesStoredSignalMatchPageFilters(
							signal,
							signalPageFiltersRef.current,
						);

						if (!matchesCurrentPage) {
							return currentSignals.filter(
								(currentSignal) => currentSignal.eventId !== signal.eventId,
							);
						}

						return upsertWebhookSignal(currentSignals, signal);
					});
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
		signalPageFiltersRef.current = signalPageFilters;
	}, [signalPageFilters]);

	useEffect(() => {
		const requestId = signalPageRequestIdRef.current + 1;
		signalPageRequestIdRef.current = requestId;
		const controller = new AbortController();

		async function loadSignalPage() {
			if (!signalPageFilters.symbol) {
				setSignalPageSignals([]);
				setSignalPageCursor(null);
				setStatusCounts({
					active: 0,
					history: 0,
				});
				setIsSignalPageLoading(false);
				setIsSignalPageLoadingMore(false);
				return;
			}

			setIsSignalPageLoading(true);
			setIsSignalPageLoadingMore(false);

			try {
				const response = await fetch(
					`/api/signals?${getSignalPageSearchParams(signalPageFilters).toString()}`,
					{
						cache: "no-store",
						signal: controller.signal,
					},
				);

				if (!response.ok) {
					if (signalPageRequestIdRef.current === requestId) {
						setSignalPageSignals([]);
						setSignalPageCursor(null);
						setIsSignalPageLoading(false);
					}
					return;
				}

				const data = (await response.json()) as SignalsListResponse;

				if (signalPageRequestIdRef.current === requestId) {
					setSignalPageSignals(
						data.signals.filter((signal) => !isBlockedSignalTrader(signal.source)),
					);
					setSignalPageCursor(data.nextCursor);
					setStatusCounts(data.counts);
					setIsSignalPageLoading(false);
				}
			} catch {
				if (!controller.signal.aborted && signalPageRequestIdRef.current === requestId) {
					setSignalPageSignals([]);
					setSignalPageCursor(null);
					setIsSignalPageLoading(false);
				}
			}
		}

		void loadSignalPage();

		return () => {
			controller.abort();
		};
	}, [signalPageFilters, signalPageRefreshKey]);

	useEffect(() => {
		let isMounted = true;
		const controller = new AbortController();

		async function loadKlines() {
			if (!selectedSymbol) {
				setBinanceCandles(null);
				setIsKlinesLoading(false);
				return;
			}

			setIsKlinesLoading(true);

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
						setBinanceCandles({
							candles: [],
							symbol: selectedSymbol,
							timeframe: selectedTimeframe,
						});
						setIsKlinesLoading(false);
					}
					return;
				}

				const data = (await response.json()) as SignalKlinesResponse;

				if (isMounted) {
					setBinanceCandles({
						candles: data.klines.map((kline) => ({
							close: kline.close,
							high: kline.high,
							low: kline.low,
							open: kline.open,
							time: kline.time as UTCTimestamp,
						})),
						symbol: selectedSymbol,
						timeframe: selectedTimeframe,
					});
					setIsKlinesLoading(false);
				}
			} catch {
				if (!controller.signal.aborted && isMounted) {
					setBinanceCandles({
						candles: [],
						symbol: selectedSymbol,
						timeframe: selectedTimeframe,
					});
					setIsKlinesLoading(false);
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
			if (selectedSymbol) {
				setSelectedSymbol("");
				setActiveSignalId(null);
				setBinanceCandles(null);
				setIsKlinesLoading(false);
			}
			return;
		}

		if (!instruments.some((instrument) => instrument.symbol === selectedSymbol)) {
			setIsKlinesLoading(true);
			setBinanceCandles(null);
			setSelectedSymbol(instruments[0]?.symbol ?? "");
			setActiveSignalId(null);
		}
	}, [instruments, selectedSymbol]);

	useEffect(() => {
		if (!isSignupTrial) {
			return;
		}

		try {
			if (window.localStorage.getItem(guideStorageKey)) {
				return;
			}
		} catch {
			return;
		}

		setWelcomeDialogOpen(true);
	}, [guideStorageKey, isSignupTrial]);

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
					const previousPrice =
						currentQuotes[ticker.symbol]?.price ?? currentInstrument.price;
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
		if (!selectedSymbol) {
			setBinanceCandles(null);
			return;
		}

		const disconnect = connectBinanceSocket(
			`${BINANCE_STREAM_BASE_URL}/ws/${selectedSymbol.toLowerCase()}@kline_${selectedTimeframe}`,
			(eventData) => {
				const candle = parseKlinePayload(eventData);

				if (!candle) {
					return;
				}

				setBinanceCandles((currentCandles) => {
					if (
						!currentCandles ||
						currentCandles.symbol !== selectedSymbol ||
						currentCandles.timeframe !== selectedTimeframe ||
						currentCandles.candles.length < MIN_CHART_CANDLES
					) {
						return currentCandles;
					}

					return {
						...currentCandles,
						candles: upsertCandle(currentCandles.candles, candle),
					};
				});
			},
		);

		return disconnect;
	}, [selectedSymbol, selectedTimeframe]);

	const filteredSignals = signalPageTradeSignals;

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

	const candles = useMemo(() => {
		if (
			binanceCandles?.symbol !== selectedSymbol ||
			binanceCandles.timeframe !== selectedTimeframe ||
			binanceCandles.candles.length < MIN_CHART_CANDLES
		) {
			return [];
		}

		return binanceCandles.candles;
	}, [binanceCandles, selectedSymbol, selectedTimeframe]);

	const selectedInstrument =
		instruments.find((instrument) => instrument.symbol === selectedSymbol) ?? null;
	const selectedPricePrecision =
		selectedInstrument?.pricePrecision ?? getDefaultPricePrecision(selectedSymbol);
	const hasKlineResponseForSelection =
		!!selectedSymbol &&
		binanceCandles?.symbol === selectedSymbol &&
		binanceCandles.timeframe === selectedTimeframe;
	const chartPricePrecision = getChartPricePrecision(
		candles,
		chartSignals,
		selectedPricePrecision,
	);
	function formatPrice(value: number, fractionDigits = selectedPricePrecision) {
		return new Intl.NumberFormat(locale, {
			maximumFractionDigits: fractionDigits,
			minimumFractionDigits: fractionDigits,
		}).format(value);
	}
	const isTickerLoading =
		(isSignalsLoading || supportedSymbols === null) && instruments.length === 0;
	const isChartLoading =
		isSignalsLoading ||
		supportedSymbols === null ||
		(instruments.length > 0 && !selectedSymbol) ||
		(!!selectedSymbol && (isKlinesLoading || !hasKlineResponseForSelection));
	const canShowChart =
		!!selectedSymbol &&
		!!selectedInstrument &&
		!isChartLoading &&
		candles.length >= MIN_CHART_CANDLES;

	function focusSignal(signal: SignalChartSignal) {
		setActiveSignalId(signal.id);
	}

	async function loadMoreSignals() {
		if (!selectedSymbol || !signalPageCursor || isSignalPageLoadingMore) {
			return;
		}

		const requestId = signalPageRequestIdRef.current;
		const filters: SignalPageFilters = {
			direction: selectedDirection,
			entryStatus: selectedEntryStatus,
			sourceIds: selectedSourceIds,
			status: selectedStatus,
			submittedAfter: getSubmittedAfterForTimeRange(selectedTimeRange),
			symbol: selectedSymbol,
		};

		setIsSignalPageLoadingMore(true);

		try {
			const response = await fetch(
				`/api/signals?${getSignalPageSearchParams(filters, signalPageCursor).toString()}`,
				{
					cache: "no-store",
				},
			);

			if (!response.ok) {
				if (signalPageRequestIdRef.current === requestId) {
					setIsSignalPageLoadingMore(false);
				}
				return;
			}

			const data = (await response.json()) as SignalsListResponse;

			if (signalPageRequestIdRef.current === requestId) {
				setSignalPageSignals((currentSignals) => {
					const seenIds = new Set(currentSignals.map((signal) => signal.id));
					const nextSignals = data.signals.filter(
						(signal) =>
							!seenIds.has(signal.id) && !isBlockedSignalTrader(signal.source),
					);

					return [...currentSignals, ...nextSignals];
				});
				setSignalPageCursor(data.nextCursor);
				setStatusCounts(data.counts);
				setIsSignalPageLoadingMore(false);
			}
		} catch {
			if (signalPageRequestIdRef.current === requestId) {
				setIsSignalPageLoadingMore(false);
			}
		}
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

	function markGuideSeen() {
		try {
			window.localStorage.setItem(guideStorageKey, "seen");
		} catch {
			// Ignore private browsing storage failures; the guide is non-critical.
		}
	}

	function dismissWelcomeDialog() {
		markGuideSeen();
		setWelcomeDialogOpen(false);
	}

	function startGuide() {
		markGuideSeen();
		setWelcomeDialogOpen(false);
		setIsSignalPanelCollapsed(false);
		setGuideStepIndex(0);
		setGuideOpen(true);
	}

	function replayGuide() {
		setIsSignalPanelCollapsed(false);
		setGuideStepIndex(0);
		setGuideOpen(true);
	}

	function closeGuide() {
		setGuideOpen(false);
	}

	function goToNextGuideStep() {
		if (guideStepIndex >= guideSteps.length - 1) {
			closeGuide();
			return;
		}

		setGuideStepIndex((currentStep) => currentStep + 1);
	}

	const guideSteps: SignalsGuideStep[] = [
		{
			icon: RadioIcon,
			target: "ticker",
			title: t("guide.steps.market.title"),
			description: t("guide.steps.market.description"),
		},
		{
			icon: CrownIcon,
			target: "traders",
			title: t("guide.steps.traders.title"),
			description: t("guide.steps.traders.description"),
		},
		{
			icon: TargetIcon,
			target: "filters",
			title: t("guide.steps.filters.title"),
			description: t("guide.steps.filters.description"),
		},
		{
			icon: ChartCandlestickIcon,
			target: "chart",
			title: t("guide.steps.chart.title"),
			description: t("guide.steps.chart.description"),
		},
		{
			icon: SlidersHorizontalIcon,
			target: "signalList",
			title: t("guide.steps.signalList.title"),
			description: t("guide.steps.signalList.description"),
		},
	];

	return (
		<div className="xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden min-h-full bg-[#141414] text-foreground">
			<style>{SIGNALS_SKELETON_STYLES}</style>
			<Dialog
				open={welcomeDialogOpen}
				onOpenChange={(open) => {
					if (open) {
						setWelcomeDialogOpen(true);
						return;
					}
					dismissWelcomeDialog();
				}}
			>
				<DialogContent className="gap-0 border-white/10 px-7 pt-8 pb-6 text-white sm:max-w-[320px] md:w-[320px] [&>button]:top-4 [&>button]:right-4 [&>button]:text-white/58 [&>button]:hover:bg-white/8 [&>button]:hover:text-white w-[min(calc(100vw_-_40px),320px)] max-w-[320px] justify-items-center overflow-hidden bg-[#181818] text-center shadow-[0_28px_90px_rgba(0,0,0,0.52)] [&>button]:rounded-full [&>button]:opacity-100">
					<style>{TRIAL_WELCOME_CONFETTI_STYLES}</style>
					<div className="gap-4 flex w-full flex-col items-center text-center">
						<div className="size-16 relative flex items-center justify-center overflow-visible">
							{TRIAL_WELCOME_CONFETTI_PARTICLES.map((particle, index) => (
								<span
									aria-hidden="true"
									className={cn(
										"trial-confetti-particle absolute",
										particle.className,
									)}
									key={index}
									style={particle.style}
								/>
							))}
							<div
								aria-hidden="true"
								className="size-14 border-white/10 bg-white/[0.07] text-3xl flex items-center justify-center rounded-full border shadow-[0_16px_36px_rgba(0,0,0,0.32)]"
							>
								🎉
							</div>
						</div>
						<div className="gap-1.5 flex w-full flex-col items-center text-center">
							<DialogTitle className="text-xl leading-tight">
								{t("trialWelcome.title")}
							</DialogTitle>
							<DialogDescription className="text-base font-medium leading-6 text-white/72 mx-auto max-w-[248px] text-center">
								{t("trialWelcome.description")}
							</DialogDescription>
						</div>
					</div>
					<div className="mt-6 gap-2 mx-auto flex w-full max-w-[180px] flex-col items-stretch justify-center">
						<Button
							type="button"
							variant="primary"
							size="sm"
							className="h-10 gap-2 bg-white px-5 text-sm text-black ring-white/14 hover:bg-white/92 [&>svg]:!m-0 [&>svg]:size-4 w-full border-2 border-[#151515] shadow-[0_12px_30px_rgba(255,255,255,0.08)] ring-1"
							onClick={startGuide}
						>
							<CompassIcon data-icon="inline-start" />
							{t("trialWelcome.startGuide")}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs font-medium text-white/52 hover:text-white/78 w-full hover:bg-transparent"
							onClick={dismissWelcomeDialog}
						>
							{t("trialWelcome.skip")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			{guideOpen ? (
				<SignalsGuideOverlay
					onClose={closeGuide}
					onNext={goToNextGuideStep}
					step={guideSteps[guideStepIndex]}
					stepIndex={guideStepIndex}
					totalSteps={guideSteps.length}
				/>
			) : null}
			<Dialog open={isChartFullscreenOpen} onOpenChange={setIsChartFullscreenOpen}>
				<DialogContent className="gap-0 border-white/10 p-0 text-white sm:max-w-none [&>button]:right-4 [&>button]:top-4 [&>button]:bg-white/8 [&>button]:p-2 [&>button]:text-white/70 [&>button]:hover:bg-white/14 [&>button]:hover:text-white h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-none overflow-hidden bg-[#141414] shadow-[0_28px_90px_rgba(0,0,0,0.72)] [&>button]:z-50 [&>button]:rounded-full [&>button]:opacity-100">
					<div className="min-h-0 flex h-full flex-col">
						<div className="border-white/10 px-4 py-3 pr-14 flex shrink-0 items-center justify-between border-b bg-[#141414]">
							<div className="gap-3 flex items-center">
								<ChartCandlestickIcon className="size-4 text-muted-foreground" />
								<DialogTitle className="font-mono text-sm font-semibold leading-none">
									{selectedSymbol || t("chart.loadingSymbol")}
								</DialogTitle>
								<DialogDescription className="sr-only">
									{t("actions.expand")}
								</DialogDescription>
							</div>
							<div className="gap-0.5 border-white/10 p-0.5 flex items-center rounded-md border bg-[#141414]">
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
						</div>
						<div className="min-h-0 flex-1">
							{canShowChart ? (
								<TradingViewSignalChart
									activeSignal={activeSignal}
									candles={candles}
									className="min-h-0 h-full"
									formatPrice={formatPrice}
									focusedSignalId={activeSignalId}
									labels={{
										entry: t("chart.entry"),
										stopLoss: t("chart.stopLoss"),
										takeProfit: t("chart.takeProfit"),
									}}
									locale={locale}
									onSelectSignal={focusSignal}
									pricePrecision={chartPricePrecision}
									signals={chartSignals}
									symbol={selectedSymbol}
									timeframe={selectedTimeframe}
								/>
							) : isSignalsLoading || isChartLoading ? (
								<ChartSkeleton />
							) : (
								<div className="p-6 flex h-full min-h-[520px] items-center justify-center bg-[#141414]">
									<div className="max-w-sm border-white/12 px-6 py-5 rounded-xl border border-dashed text-center">
										<p className="font-medium">{t("chart.emptyTitle")}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{t("chart.emptyDescription")}
										</p>
									</div>
								</div>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<header
				className="px-4 py-2 backdrop-blur shrink-0 border-b bg-[#141414]/80"
				data-guide-target="ticker"
			>
				{isTickerLoading ? (
					<TickerSkeleton />
				) : (
					<div className="min-w-0 gap-3 no-scrollbar flex items-center overflow-x-auto">
						<div className="gap-2 pr-3 text-sm font-semibold flex shrink-0 items-center">
							<RadioIcon className="size-4 text-emerald-500" />
							<span>{t("ticker.live")}</span>
						</div>
						{instruments.length === 0 && (
							<span className="text-sm text-muted-foreground">
								{t("ticker.empty")}
							</span>
						)}
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
								<span className="size-5 bg-black font-bold flex shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px]">
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
										instrument.change >= 0
											? "text-emerald-500"
											: "text-rose-500",
									)}
								>
									{instrument.change >= 0 ? "+" : ""}
									{instrument.change.toFixed(2)}%
								</span>
							</button>
						))}
					</div>
				)}
			</header>

			<div
				className={cn(
					"gap-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden grid grid-cols-1",
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

				<main className="min-h-0 min-w-0 flex flex-col bg-[#141414]">
					<section className="px-3 py-3 shrink-0 border-b bg-[#141414]">
						<div className="gap-3 flex flex-col">
							<div
								className="no-scrollbar -mx-3 min-w-0 gap-2 px-3 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 flex flex-nowrap items-center overflow-x-auto"
								data-guide-target="traders"
							>
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

							<div
								className="gap-2 flex flex-wrap items-center"
								data-guide-target="filters"
							>
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
									aria-label={t("guide.replay")}
									title={t("guide.replay")}
									onClick={replayGuide}
								>
									<CompassIcon className="size-4" />
								</Button>
								<Button
									size="icon"
									variant="ghost"
									aria-label={t("actions.refresh")}
									onClick={() => setSignalPageRefreshKey((key) => key + 1)}
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

					<section
						className="xl:min-h-0 xl:flex-1 flex flex-col"
						data-guide-target="chart"
					>
						<div className="px-4 py-3 flex items-center justify-between border-b bg-[#141414]">
							<div className="gap-3 flex items-center">
								<ChartCandlestickIcon className="size-4 text-muted-foreground" />
								<span className="font-mono text-sm font-semibold">
									{selectedSymbol || t("chart.loadingSymbol")}
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
								<Button
									size="icon"
									variant="ghost"
									aria-label={t("actions.expand")}
									onClick={() => setIsChartFullscreenOpen(true)}
								>
									<Maximize2Icon className="size-4" />
								</Button>
							</div>
						</div>

						<div className="xl:h-auto xl:min-h-0 xl:flex-1 h-[min(620px,calc(100vh-260px))] min-h-[420px]">
							{canShowChart ? (
								<TradingViewSignalChart
									activeSignal={activeSignal}
									candles={candles}
									className="h-full"
									formatPrice={formatPrice}
									focusedSignalId={activeSignalId}
									labels={{
										entry: t("chart.entry"),
										stopLoss: t("chart.stopLoss"),
										takeProfit: t("chart.takeProfit"),
									}}
									locale={locale}
									onSelectSignal={focusSignal}
									pricePrecision={chartPricePrecision}
									signals={chartSignals}
									symbol={selectedSymbol}
									timeframe={selectedTimeframe}
								/>
							) : isSignalsLoading || isChartLoading ? (
								<ChartSkeleton />
							) : (
								<div className="p-6 flex h-full min-h-[520px] items-center justify-center bg-[#141414]">
									<div className="max-w-sm border-white/12 px-6 py-5 rounded-xl border border-dashed text-center">
										<p className="font-medium">{t("chart.emptyTitle")}</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{t("chart.emptyDescription")}
										</p>
									</div>
								</div>
							)}
						</div>
					</section>
				</main>

				<aside
					className={cn(
						"group min-h-0 xl:flex xl:flex-col xl:overflow-hidden xl:border-l xl:border-t-0 relative border-t bg-[#141414]",
					)}
					data-guide-target="signalList"
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

					<div className={cn("shrink-0 border-b", isSignalPanelCollapsed && "xl:hidden")}>
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
							"space-y-3 p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain",
							isSignalPanelCollapsed && "xl:hidden",
						)}
					>
						{isSignalPageLoading && !filteredSignals.length ? (
							<div className="p-6 rounded-md border border-dashed text-center">
								<p className="font-medium">{t("signalsPanel.loadingTitle")}</p>
								<p className="mt-1 text-sm text-muted-foreground">
									{t("signalsPanel.loadingDescription")}
								</p>
							</div>
						) : filteredSignals.length ? (
							<>
								{filteredSignals.map((signal) => {
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
											<div className="mb-3 gap-2 grid grid-cols-[minmax(0,1fr)_auto] items-start">
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
															{selectedInstrument?.symbol ??
																signal.symbol}{" "}
															· {t(`direction.${signal.direction}`)}
														</p>
													</div>
												</div>
												<span
													className={cn(
														"px-2 py-1 font-semibold leading-tight max-w-[72px] rounded-full border text-center text-[11px]",
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
													value={
														signal.takeProfit === undefined
															? "--"
															: formatPrice(signal.takeProfit)
													}
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
														? signal.takeProfit === undefined
															? "--"
															: signal.confidence.toFixed(2)
														: statusPresentation.label}
												</span>
											</div>
										</button>
									);
								})}
								{signalPageCursor ? (
									<Button
										type="button"
										variant="secondary"
										size="sm"
										className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10 w-full"
										disabled={isSignalPageLoadingMore}
										onClick={loadMoreSignals}
									>
										{isSignalPageLoadingMore
											? t("signalsPanel.loadingMore")
											: t("signalsPanel.loadMore")}
									</Button>
								) : null}
							</>
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

function TickerSkeleton() {
	return (
		<div className="min-w-0 gap-3 no-scrollbar flex items-center overflow-hidden">
			<div className="gap-2 pr-3 text-sm font-semibold flex shrink-0 items-center">
				<RadioIcon className="size-4 text-emerald-500/70" />
				<Skeleton className="h-5 w-20 bg-white/10" />
			</div>
			{TICKER_SKELETON_WIDTHS.map((width, index) => (
				<div
					key={`${width}-${index}`}
					className={cn(
						"gap-2 px-3 py-1.5 border-white/8 bg-white/[0.025] flex shrink-0 items-center rounded-md border",
						width,
					)}
				>
					<Skeleton className="size-5 bg-white/12 shrink-0 rounded-full" />
					<Skeleton className="h-4 w-10 bg-white/10" />
					<Skeleton className="h-4 w-12 bg-white/8" />
					<Skeleton className="h-3 w-10 bg-emerald-400/15" />
				</div>
			))}
		</div>
	);
}

function ChartSkeleton() {
	return (
		<div className="relative h-full min-h-[520px] overflow-hidden bg-[#141414]">
			<div className="left-6 top-5 gap-3 absolute z-10 flex items-center">
				<Skeleton className="h-6 w-24 bg-white/10" />
				<Skeleton className="h-5 w-10 bg-white/8" />
			</div>
			<div className="inset-x-0 bottom-10 top-20 absolute">
				<div className="inset-0 absolute bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:72px_64px]" />
				<div className="inset-0 absolute bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.045),transparent_42%)]" />
				<div className="inset-x-8 bottom-0 top-5 gap-1.5 absolute flex items-end">
					{CHART_SKELETON_BARS.map((height, index) => (
						<div
							key={`${height}-${index}`}
							className="relative flex flex-1 items-end justify-center"
						>
							<span
								className="bottom-0 bg-white/10 absolute w-px rounded-full"
								style={{ height: `${Math.min(94, height + 18)}%` }}
							/>
							<span
								className={cn(
									"min-w-1 max-w-3 w-full rounded-sm",
									index % 3 === 0 ? "bg-emerald-400/22" : "bg-white/12",
								)}
								style={{ height: `${height}%` }}
							/>
						</div>
					))}
				</div>
				<div className="signals-skeleton-shimmer inset-0 via-white/[0.055] absolute -translate-x-full bg-gradient-to-r from-transparent to-transparent" />
			</div>
		</div>
	);
}

interface SignalsGuideOverlayProps {
	step: SignalsGuideStep;
	stepIndex: number;
	totalSteps: number;
	onClose: () => void;
	onNext: () => void;
}

function SignalsGuideOverlay({
	step,
	stepIndex,
	totalSteps,
	onClose,
	onNext,
}: SignalsGuideOverlayProps) {
	const t = useTranslations("signals.guide");
	const Icon = step.icon;
	const isLastStep = stepIndex === totalSteps - 1;
	const [targetRect, setTargetRect] = useState<GuideTargetRect | null>(null);
	const [viewportSize, setViewportSize] = useState<GuideViewportSize>({
		height: 0,
		width: 0,
	});
	const cardStyle = getGuideCardStyle(targetRect, viewportSize);

	useEffect(() => {
		let frame = 0;
		let measureTimer = 0;

		function measureTarget() {
			setViewportSize({
				height: window.innerHeight,
				width: window.innerWidth,
			});

			const targetElement = document.querySelector<HTMLElement>(
				`[data-guide-target="${step.target}"]`,
			);

			if (!targetElement) {
				setTargetRect(null);
				return;
			}

			setTargetRect(getGuideTargetRect(targetElement));
		}

		function scheduleMeasure() {
			window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(measureTarget);
		}

		const targetElement = document.querySelector<HTMLElement>(
			`[data-guide-target="${step.target}"]`,
		);

		targetElement?.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "nearest",
		});

		measureTimer = window.setTimeout(scheduleMeasure, 180);
		scheduleMeasure();

		window.addEventListener("resize", scheduleMeasure);
		window.addEventListener("scroll", scheduleMeasure, true);

		return () => {
			window.clearTimeout(measureTimer);
			window.cancelAnimationFrame(frame);
			window.removeEventListener("resize", scheduleMeasure);
			window.removeEventListener("scroll", scheduleMeasure, true);
		};
	}, [step.target]);

	return (
		<div className="inset-0 pointer-events-none fixed z-50">
			{targetRect ? (
				<>
					<div
						className="bg-black/76 absolute backdrop-blur-[1px]"
						style={{
							height: targetRect.top,
							left: 0,
							right: 0,
							top: 0,
						}}
					/>
					<div
						className="bg-black/76 absolute backdrop-blur-[1px]"
						style={{
							bottom: 0,
							left: 0,
							right: 0,
							top: targetRect.bottom,
						}}
					/>
					<div
						className="bg-black/76 absolute backdrop-blur-[1px]"
						style={{
							bottom: viewportSize.height - targetRect.bottom,
							left: 0,
							top: targetRect.top,
							width: targetRect.left,
						}}
					/>
					<div
						className="bg-black/76 absolute backdrop-blur-[1px]"
						style={{
							bottom: viewportSize.height - targetRect.bottom,
							left: targetRect.right,
							right: 0,
							top: targetRect.top,
						}}
					/>
					<div
						className="absolute rounded-xl border border-primary/80 bg-primary/8 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_28px_rgba(16,185,129,0.32)]"
						style={{
							height: targetRect.height,
							left: targetRect.left,
							top: targetRect.top,
							width: targetRect.width,
						}}
					/>
				</>
			) : (
				<div className="inset-0 bg-black/76 absolute backdrop-blur-[1px]" />
			)}
			<div
				className="border-white/10 p-4 text-white shadow-2xl pointer-events-auto absolute rounded-xl border bg-[#172033]/95"
				style={cardStyle}
			>
				<div className="gap-3 flex items-start">
					<div className="size-10 flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
						<Icon className="size-5" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-xs font-semibold text-primary uppercase">
							{t("stepCounter", {
								current: stepIndex + 1,
								total: totalSteps,
							})}
						</p>
						<h2 className="mt-1 text-lg font-semibold leading-snug">{step.title}</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							{step.description}
						</p>
					</div>
				</div>

				<div className="mt-4 gap-1.5 flex">
					{Array.from({ length: totalSteps }).map((_, index) => (
						<span
							key={index}
							className={cn(
								"h-1 flex-1 rounded-full",
								index <= stepIndex ? "bg-primary" : "bg-white/10",
							)}
						/>
					))}
				</div>

				<div className="mt-4 gap-2 flex justify-end">
					<Button type="button" variant="ghost" size="sm" onClick={onClose}>
						{t("close")}
					</Button>
					<Button type="button" variant="primary" size="sm" onClick={onNext}>
						{isLastStep ? t("finish") : t("next")}
					</Button>
				</div>
			</div>
		</div>
	);
}
