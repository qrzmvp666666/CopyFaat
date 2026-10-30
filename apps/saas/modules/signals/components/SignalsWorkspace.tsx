"use client";

import { useSession } from "@auth/hooks/use-session";
import { PricingTable } from "@payments/components/PricingTable";
import { Button, cn } from "@repo/ui";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@repo/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { getProfileAvatarUrlForSeed } from "@repo/utils";
import { SignalsMobilePaywall } from "@signals/components/SignalsMobilePaywall";
import type { UTCTimestamp } from "lightweight-charts";
import {
	ChartCandlestickIcon,
	CheckCircle2Icon,
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	Clock3Icon,
	CompassIcon,
	CrownIcon,
	Maximize2Icon,
	RadioIcon,
	RefreshCwIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	StarIcon,
	TargetIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	XCircleIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { isBlockedSignalTrader, isDemoStrategyTrader } from "../lib/signal-identity";
import type {
	SignalKlinesResponse,
	SignalsListResponse,
	SignalsPreviewResponse,
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
const SOURCE_PICKER_CATEGORIES = ["watchlist", "contract"] as const;
const SOURCE_FOLLOW_STORAGE_KEY = "signalfast:followed-sources:v1";
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

const CHART_FULLSCREEN_STYLES = `
@media (orientation: portrait) and (max-width: 768px) {
	[data-chart-landscape-dialog="true"] {
		position: fixed !important;
		top: 0 !important;
		left: 0 !important;
		width: 100vw !important;
		height: 100dvh !important;
		max-width: none !important;
		max-height: none !important;
		transform: none !important;
		translate: 0 0 !important;
		border-radius: 0 !important;
	}
	[data-chart-landscape-dialog="true"] > button {
		top: calc(env(safe-area-inset-top) + 8px) !important;
		right: calc(env(safe-area-inset-right) + 8px) !important;
	}
	[data-chart-landscape-toolbar="true"] {
		padding-top: calc(env(safe-area-inset-top) + 12px) !important;
	}

	[data-chart-landscape-stage="true"] {
		position: absolute !important;
		top: calc(env(safe-area-inset-top) + 48px) !important;
		left: 100vw !important;
		width: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 48px) !important;
		height: 100vw !important;
		max-width: none !important;
		transform: rotate(90deg) !important;
		transform-origin: top left !important;
	}
}
`;

type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];
type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];
type SignalStatus = (typeof SIGNAL_STATUSES)[number];
type TimeRange = (typeof TIME_RANGES)[number];
type EntryStatus = (typeof ENTRY_STATUSES)[number];
type SignalsGuideTarget = "chart" | "filters" | "signalList" | "ticker" | "traders";

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
const SIGNALS_API_PAGE_SIZE = 200;
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

async function canDisplaySymbolChart(
	symbol: string,
	signal?: AbortSignal,
): Promise<boolean | null> {
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

		if (response.status === 404) {
			return false;
		}

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as SignalKlinesResponse;

		return data.klines.length >= MIN_CHART_CANDLES;
	} catch {
		return null;
	}
}

function createSourceFilter(source: SignalsPreviewResponse["sources"][number]): Source {
	const name = source.name;
	const id = source.id ?? normalizeSourceKey(name);

	return {
		accent: getSymbolAccent(id),
		avatar: source.avatarUrl ?? getProfileAvatarUrlForSeed(id, 80),
		handle: source.handle ?? source.platform ?? "",
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
			getProfileAvatarUrlForSeed(signal.source.id ?? signal.source.name, 80),
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
	return signals.find((signal) => signal.id === activeSignalId) ?? null;
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
		limit: String(SIGNALS_API_PAGE_SIZE),
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

function getStoredSignalBusinessKey(signal: StoredSignal) {
	return [
		signal.source.id ?? normalizeSourceKey(signal.source.name),
		signal.symbol,
		signal.direction,
		signal.entry,
		signal.takeProfit ?? "no-tp",
		signal.stopLoss,
	].join("|");
}

async function fetchAllStoredSignals(
	params: URLSearchParams,
	signal?: AbortSignal,
): Promise<SignalsListResponse> {
	const signals: StoredSignal[] = [];
	const seenBusinessKeys = new Set<string>();
	let cursor: string | null = null;
	let counts: SignalsListResponse["counts"] = {
		active: 0,
		history: 0,
	};

	do {
		const pageParams = new URLSearchParams(params);
		pageParams.set("limit", String(SIGNALS_API_PAGE_SIZE));

		if (cursor) {
			pageParams.set("cursor", cursor);
		}

		const response = await fetch(`/api/signals?${pageParams.toString()}`, {
			cache: "no-store",
			signal,
		});

		if (!response.ok) {
			throw new Error("Failed to load signals.");
		}

		const page = (await response.json()) as SignalsListResponse;
		counts = page.counts;

		for (const nextSignal of page.signals) {
			const businessKey = getStoredSignalBusinessKey(nextSignal);

			if (!seenBusinessKeys.has(businessKey)) {
				seenBusinessKeys.add(businessKey);
				signals.push(nextSignal);
			}
		}

		cursor = page.nextCursor;
	} while (cursor);

	return {
		counts,
		nextCursor: null,
		signals,
	};
}

function doesTradeSignalMatchFilters(signal: TradeSignal, filters: SignalPageFilters) {
	if (signal.symbol !== filters.symbol || signal.status !== filters.status) {
		return false;
	}

	if (!matchesSelectedSources(signal, filters.sourceIds)) {
		return false;
	}

	if (filters.direction !== "all" && signal.direction !== filters.direction) {
		return false;
	}

	if (filters.entryStatus !== "all" && signal.entryStatus !== filters.entryStatus) {
		return false;
	}

	if (filters.submittedAfter) {
		const submittedAt = signal.submittedAtTime
			? new Date(Number(signal.submittedAtTime) * 1000)
			: null;

		if (!submittedAt || submittedAt < filters.submittedAfter) {
			return false;
		}
	}

	return true;
}

function clampNumber(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function getGuideTargetElement(target: SignalsGuideStep["target"]) {
	return Array.from(
		document.querySelectorAll<HTMLElement>(`[data-guide-target="${target}"]`),
	).find((element) => {
		const rect = element.getBoundingClientRect();
		return (
			rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden"
		);
	});
}

function getGuideTargetRect(element: HTMLElement): GuideTargetRect | null {
	const rect = element.getBoundingClientRect();
	const padding = 8;
	const viewportWidth = window.innerWidth;
	const previewRect = document
		.querySelector<HTMLElement>("[data-guide-viewport]")
		?.getBoundingClientRect();
	const viewportHeight = Math.min(window.innerHeight, previewRect?.bottom ?? window.innerHeight);
	if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= viewportHeight) {
		return null;
	}
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

interface SignalsWorkspaceProps {
	isAuthenticated: boolean;
	hasProAccess: boolean;
}

export function SignalsWorkspace({ isAuthenticated, hasProAccess }: SignalsWorkspaceProps) {
	const { user } = useSession();
	const t = useTranslations("signals");
	const sourcePickerT = useTranslations("signals.sourcePicker");
	const locale = useLocale();
	const [webhookSignals, setWebhookSignals] = useState<StoredSignal[]>([]);
	const [signalPageSignals, setSignalPageSignals] = useState<StoredSignal[]>([]);
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
	const defaultSourcesInitializedRef = useRef(false);
	const defaultSignalInitializedRef = useRef(false);
	const defaultSourceIdRef = useRef<string | null>(null);
	const [selectedDirection, setSelectedDirection] = useState<SignalDirection>("all");
	const [selectedStatus, setSelectedStatus] = useState<SignalStatus>("active");
	const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("30d");
	const [selectedEntryStatus, setSelectedEntryStatus] = useState<EntryStatus>("all");
	const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
	const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
	const [sourcePickerQuery, setSourcePickerQuery] = useState("");
	const [followedSourceIds, setFollowedSourceIds] = useState<string[] | null>(null);
	const [sourcePickerCategory, setSourcePickerCategory] =
		useState<(typeof SOURCE_PICKER_CATEGORIES)[number]>("contract");
	const [draftDirection, setDraftDirection] = useState<SignalDirection>("all");
	const [draftTimeRange, setDraftTimeRange] = useState<TimeRange>("30d");
	const [draftEntryStatus, setDraftEntryStatus] = useState<EntryStatus>("all");
	const [activeSignalId, setActiveSignalId] = useState<string | null>(null);
	const [isSignalPanelCollapsed, setIsSignalPanelCollapsed] = useState(false);
	const [isChartCollapsed, setIsChartCollapsed] = useState(false);
	const [isChartFullscreenOpen, setIsChartFullscreenOpen] = useState(false);
	const [isSignalsLoading, setIsSignalsLoading] = useState(true);
	const [preview, setPreview] = useState<SignalsPreviewResponse>({
		signals: [],
		sources: [],
		tradingSymbols: [
			{
				id: "BTCUSDT",
				symbol: "BTCUSDT",
				baseAsset: "BTC",
				quoteAsset: "USDT",
				exchange: "binance",
				pricePrecision: 2,
			},
		],
	});
	const [isSignalPageLoading, setIsSignalPageLoading] = useState(true);
	const [isKlinesLoading, setIsKlinesLoading] = useState(false);
	const [guideOpen, setGuideOpen] = useState(!hasProAccess);
	const [guideCardHeight, setGuideCardHeight] = useState(300);
	const [paywallOpen, setPaywallOpen] = useState(false);
	const [isMobilePaywall, setIsMobilePaywall] = useState(false);
	const [guideStepIndex, setGuideStepIndex] = useState(0);
	const signalPageRequestIdRef = useRef(0);
	const [signalPageRefreshKey, setSignalPageRefreshKey] = useState(0);
	const [supportedSymbols, setSupportedSymbols] = useState<Set<string> | null>(null);
	const symbolAvailabilityRef = useRef(new Map<string, boolean>());
	const [symbolAvailabilityRetryVersion, setSymbolAvailabilityRetryVersion] = useState(0);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 767px)");
		const updateMobileState = () => setIsMobilePaywall(mediaQuery.matches);
		updateMobileState();
		mediaQuery.addEventListener("change", updateMobileState);
		return () => mediaQuery.removeEventListener("change", updateMobileState);
	}, []);

	useEffect(() => {
		if (hasProAccess) return;
		const controller = new AbortController();
		async function loadPreview() {
			try {
				const response = await fetch("/api/signals/preview", { signal: controller.signal });
				if (!response.ok) return;
				const data = (await response.json()) as SignalsPreviewResponse;
				setPreview((current) => ({
					signals: data.signals.slice(0, 3),
					sources: data.sources,
					tradingSymbols: data.tradingSymbols.length
						? data.tradingSymbols
						: current.tradingSymbols,
				}));
			} catch {
				// Keep public exchange markets visible if workspace metadata is unavailable.
			}
		}
		void loadPreview();
		return () => controller.abort();
	}, [hasProAccess]);
	const visibleWebhookSignals = useMemo(() => {
		if (!supportedSymbols) {
			return [];
		}

		return webhookSignals.filter(
			(signal) => !isDemoStrategyTrader(signal.source) && supportedSymbols.has(signal.symbol),
		);
	}, [supportedSymbols, webhookSignals]);
	const visibleSignalPageSignals = useMemo(() => {
		if (!supportedSymbols) {
			return [];
		}

		return signalPageSignals.filter(
			(signal) => !isDemoStrategyTrader(signal.source) && supportedSymbols.has(signal.symbol),
		);
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
		if (!hasProAccess) {
			for (const symbol of preview.tradingSymbols) symbols.set(symbol.symbol, symbol);
		}

		for (const signal of visibleWebhookSignals) {
			symbols.set(signal.tradingSymbol.symbol, signal.tradingSymbol);
		}

		return Array.from(symbols.values())
			.map(createInstrumentFromTradingSymbol)
			.sort(sortInstrumentsByPriority);
	}, [hasProAccess, preview.tradingSymbols, visibleWebhookSignals]);
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
		if (!hasProAccess) {
			for (const source of preview.sources) {
				const filter = createSourceFilter(source);
				sources.set(filter.id, filter);
			}
		}

		for (const signal of visibleWebhookSignals) {
			const source = createSourceFilter(signal.source);
			const existingSource = sources.get(source.id);
			sources.set(source.id, {
				...source,
				avatar: existingSource?.avatar ?? source.avatar,
				handle: existingSource?.handle || source.handle,
			});
		}

		return Array.from(sources.values()).sort((a, b) => a.name.localeCompare(b.name));
	}, [hasProAccess, preview.sources, visibleWebhookSignals]);
	const filteredSourcePickerSources = useMemo(() => {
		const query = sourcePickerQuery.trim().toLocaleLowerCase();
		const categorySources =
			sourcePickerCategory === "contract"
				? sourceFilters
				: sourcePickerCategory === "watchlist"
					? sourceFilters.filter((source) =>
							(followedSourceIds ?? []).includes(source.id),
						)
					: [];

		return categorySources.filter((source) =>
			`${source.name} ${source.handle}`.toLocaleLowerCase().includes(query),
		);
	}, [followedSourceIds, sourceFilters, sourcePickerCategory, sourcePickerQuery]);
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

		if (!hasProAccess) {
			setSupportedSymbols(new Set(preview.tradingSymbols.map((symbol) => symbol.symbol)));
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

		let retryTimer: number | undefined;

		async function loadSymbolAvailability() {
			const availability = await Promise.all(
				symbolsToCheck.map(async (symbol) => {
					const canDisplay = await canDisplaySymbolChart(
						symbol.symbol,
						controller.signal,
					);

					if (!controller.signal.aborted && canDisplay !== null) {
						symbolAvailabilityRef.current.set(symbol.symbol, canDisplay);
					}

					return canDisplay;
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

			if (availability.some((canDisplay) => canDisplay === null)) {
				retryTimer = window.setTimeout(() => {
					setSymbolAvailabilityRetryVersion((version) => version + 1);
				}, 5_000);
			}
		}

		void loadSymbolAvailability();

		return () => {
			controller.abort();

			if (retryTimer) {
				window.clearTimeout(retryTimer);
			}
		};
	}, [
		hasProAccess,
		isSignalsLoading,
		preview.tradingSymbols,
		symbolAvailabilityRetryVersion,
		webhookSignals,
	]);

	useEffect(() => {
		if (!hasProAccess) {
			setWebhookSignals([]);
			setIsSignalsLoading(false);
			return;
		}
		let isMounted = true;
		const controller = new AbortController();

		async function loadWebhookSignals() {
			try {
				const data = await fetchAllStoredSignals(new URLSearchParams(), controller.signal);

				if (isMounted) {
					const visibleSignals = data.signals.filter(
						(signal) => !isBlockedSignalTrader(signal.source),
					);
					setWebhookSignals(visibleSignals);
					setIsSignalsLoading(false);
				}
			} catch {
				if (!controller.signal.aborted && isMounted) {
					setIsSignalsLoading(false);
				}
			}
		}

		void loadWebhookSignals();
		const eventSource = new EventSource("/api/signals/events");

		eventSource.addEventListener("signal", (event) => {
			try {
				const signal = JSON.parse((event as MessageEvent<string>).data) as StoredSignal;
				if (isBlockedSignalTrader(signal.source) || isDemoStrategyTrader(signal.source)) {
					return;
				}

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
			controller.abort();
			eventSource.close();
		};
	}, [hasProAccess]);

	useEffect(() => {
		signalPageFiltersRef.current = signalPageFilters;
	}, [signalPageFilters]);

	useEffect(() => {
		const requestId = signalPageRequestIdRef.current + 1;
		signalPageRequestIdRef.current = requestId;
		const controller = new AbortController();

		async function loadSignalPage() {
			if (!hasProAccess || !signalPageFilters.symbol) {
				setSignalPageSignals([]);
				setStatusCounts({
					active: 0,
					history: 0,
				});
				setIsSignalPageLoading(false);
				return;
			}

			setIsSignalPageLoading(true);

			try {
				const data = await fetchAllStoredSignals(
					getSignalPageSearchParams(signalPageFilters),
					controller.signal,
				);

				if (signalPageRequestIdRef.current === requestId) {
					const visibleSignals = data.signals.filter(
						(signal) =>
							!isBlockedSignalTrader(signal.source) &&
							!isDemoStrategyTrader(signal.source),
					);
					setSignalPageSignals(visibleSignals);
					setStatusCounts({
						active: visibleSignals.filter((signal) => signal.status === "active")
							.length,
						history: visibleSignals.filter((signal) => signal.status === "history")
							.length,
					});
					setIsSignalPageLoading(false);
				}
			} catch {
				if (!controller.signal.aborted && signalPageRequestIdRef.current === requestId) {
					setSignalPageSignals([]);
					setIsSignalPageLoading(false);
				}
			}
		}

		void loadSignalPage();

		return () => {
			controller.abort();
		};
	}, [hasProAccess, signalPageFilters, signalPageRefreshKey]);

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
				const endpoint = hasProAccess ? "/api/signals/klines" : "/api/market/klines";
				const response = await fetch(`${endpoint}?${params.toString()}`, {
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
	}, [hasProAccess, selectedSymbol, selectedTimeframe]);

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
		try {
			const storedSourceIds = window.localStorage.getItem(SOURCE_FOLLOW_STORAGE_KEY);
			const parsedSourceIds: unknown = storedSourceIds ? JSON.parse(storedSourceIds) : [];

			setFollowedSourceIds(
				Array.isArray(parsedSourceIds)
					? parsedSourceIds.filter(
							(sourceId): sourceId is string => typeof sourceId === "string",
						)
					: [],
			);
		} catch {
			setFollowedSourceIds([]);
		}
	}, []);

	useEffect(() => {
		if (followedSourceIds === null) {
			return;
		}

		try {
			window.localStorage.setItem(
				SOURCE_FOLLOW_STORAGE_KEY,
				JSON.stringify(followedSourceIds),
			);
		} catch {
			// Keep the follow control usable when browser storage is unavailable.
		}
	}, [followedSourceIds]);

	useEffect(() => {
		if (
			defaultSourcesInitializedRef.current ||
			!sourceFilters.length ||
			(process.env.NODE_ENV !== "production" && !selectedSymbol)
		) {
			return;
		}

		const firstSourceId = sourceFilters[0].id;
		defaultSourcesInitializedRef.current = true;
		defaultSourceIdRef.current = firstSourceId;
		setSelectedSourceIds([firstSourceId]);
	}, [selectedSymbol, sourceFilters]);

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
	}, [hasProAccess, baseInstruments, tickerSymbols]);

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
	}, [hasProAccess, selectedSymbol, selectedTimeframe]);

	const filteredSignals = signalPageTradeSignals;
	useEffect(() => {
		if (
			!defaultSourcesInitializedRef.current ||
			defaultSignalInitializedRef.current ||
			!filteredSignals.length
		) {
			return;
		}

		const firstSourceSignal = filteredSignals.find(
			(signal) => signal.sourceId === defaultSourceIdRef.current,
		);

		if (firstSourceSignal) {
			defaultSignalInitializedRef.current = true;
			setActiveSignalId(firstSourceSignal.id);
		}
	}, [filteredSignals]);

	const activeSignal = getSelectedSignal(filteredSignals, activeSignalId);
	const chartSignals = activeSignal ? [activeSignal] : filteredSignals;

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
	const displayedStatusCounts = {
		...statusCounts,
		active: statusCounts.active,
	};
	const activeMobileFilterCount =
		selectedSourceIds.length +
		Number(selectedDirection !== "all") +
		Number(selectedTimeRange !== "30d") +
		Number(selectedEntryStatus !== "all");
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

	function selectSymbol(symbol: string) {
		setSelectedSymbol(symbol);
		setSelectedSourceIds([]);
		const filters: SignalPageFilters = {
			...signalPageFilters,
			sourceIds: [],
			symbol,
		};
		const nextSignal = signals.find((signal) => doesTradeSignalMatchFilters(signal, filters));
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

	function toggleSourceFollow(sourceId: string) {
		setFollowedSourceIds((currentSourceIds) => {
			const sourceIds = currentSourceIds ?? [];

			return sourceIds.includes(sourceId)
				? sourceIds.filter((currentSourceId) => currentSourceId !== sourceId)
				: [...sourceIds, sourceId];
		});
	}

	function openMobileFilters(open: boolean) {
		if (open) {
			setDraftDirection(selectedDirection);
			setDraftTimeRange(selectedTimeRange);
			setDraftEntryStatus(selectedEntryStatus);
		}
		setIsMobileFiltersOpen(open);
	}

	function applyMobileFilters() {
		setSelectedDirection(draftDirection);
		setSelectedTimeRange(draftTimeRange);
		setSelectedEntryStatus(draftEntryStatus);
		setActiveSignalId(null);
		setIsMobileFiltersOpen(false);
	}

	function resetMobileFilters() {
		setDraftDirection("all");
		setDraftTimeRange("30d");
		setDraftEntryStatus("all");
	}

	function replayGuide() {
		setIsSignalPanelCollapsed(false);
		setGuideStepIndex(0);
		setGuideOpen(true);
	}

	function closeGuide() {
		setGuideOpen(false);
		if (!hasProAccess) {
			setPaywallOpen(true);
		}
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
		<div
			data-pwa-theme-surface="signals"
			className="xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden min-h-full bg-[#141414] pt-[env(safe-area-inset-top)] text-foreground"
		>
			<style>{SIGNALS_SKELETON_STYLES}</style>
			<style>{CHART_FULLSCREEN_STYLES}</style>
			{guideOpen ? (
				<SignalsGuideOverlay
					onHeightChange={setGuideCardHeight}
					isAuthenticated={isAuthenticated}
					requiresMembership={!hasProAccess}
					onClose={closeGuide}
					onNext={goToNextGuideStep}
					step={guideSteps[guideStepIndex]}
					stepIndex={guideStepIndex}
					totalSteps={guideSteps.length}
				/>
			) : null}
			<Dialog
				open={paywallOpen && !isMobilePaywall}
				onOpenChange={(open) => {
					setPaywallOpen(open);
					if (!open && !hasProAccess) replayGuide();
				}}
			>
				<SignalsMobilePaywall
					isAuthenticated={isAuthenticated}
					open={paywallOpen && isMobilePaywall}
					onClose={() => {
						setPaywallOpen(false);
						if (!hasProAccess) replayGuide();
					}}
				/>
				<DialogContent
					overlayClassName="bg-black/20 backdrop-blur-md"
					className="border-white/10 text-white max-md:hidden sm:max-w-4xl max-h-[90dvh] overflow-y-auto bg-[#1c1a19]"
				>
					<DialogTitle>{t("paywall.title")}</DialogTitle>
					<DialogDescription>{t("paywall.description")}</DialogDescription>
					<div className="mt-5 gap-3 flex flex-col">
						<PricingTable
							planIds={["pro"]}
							userId={isAuthenticated ? user?.id : undefined}
						/>
						{!isAuthenticated ? (
							<Button asChild variant="outline" className="w-full">
								<Link href="/login?redirectTo=%2Fsignals">{t("guide.login")}</Link>
							</Button>
						) : null}
					</div>
				</DialogContent>
			</Dialog>
			<Dialog open={isChartFullscreenOpen} onOpenChange={setIsChartFullscreenOpen}>
				<DialogContent
					data-chart-landscape-dialog="true"
					className="gap-0 border-white/10 p-0 text-white sm:max-w-none [&>button]:right-4 [&>button]:top-4 [&>button]:bg-white/8 [&>button]:p-2 [&>button]:text-white/70 [&>button]:hover:bg-white/14 [&>button]:hover:text-white h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-none overflow-hidden bg-[#141414] shadow-[0_28px_90px_rgba(0,0,0,0.72)] [&>button]:z-50 [&>button]:rounded-full [&>button]:opacity-100"
				>
					<div className="min-h-0 flex h-full flex-col">
						<div
							className="border-white/10 px-4 py-3 pr-14 flex shrink-0 items-center justify-between border-b bg-[#141414]"
							data-chart-landscape-toolbar="true"
						>
							<div className="gap-3 flex items-center">
								<ChartCandlestickIcon className="size-4 text-muted-foreground" />
								<DialogTitle className="font-mono text-sm font-semibold leading-none">
									{selectedSymbol ||
										(isChartLoading
											? t("chart.loadingSymbol")
											: t("chart.emptyTitle"))}
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
						<div className="min-h-0 flex-1" data-chart-landscape-stage="true">
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
			<div
				data-guide-viewport={guideOpen ? "true" : undefined}
				className={guideOpen ? "min-h-0 overflow-y-auto overscroll-contain" : "contents"}
				style={
					guideOpen
						? { height: "100dvh", paddingBottom: guideCardHeight + 64 }
						: undefined
				}
				inert={!hasProAccess}
			>
				{!hasProAccess ? (
					<p className="px-4 py-2 text-xs text-muted-foreground">{t("guide.preview")}</p>
				) : null}
				<header
					className={cn(
						"px-4 py-2 backdrop-blur shrink-0 border-b bg-[#141414]/80",
						guideOpen ? "block" : "md:block hidden",
					)}
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
								<p className="text-xs text-muted-foreground">
									{t("market.eyebrow")}
								</p>
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
						<section className="px-3 py-3 shrink-0 bg-[#141414]">
							<div className="gap-3 flex flex-col">
								<div>
									<div
										data-guide-target="traders"
										className="md:flex md:flex-wrap md:items-start md:gap-2 hidden w-fit max-w-full"
									>
										<button
											type="button"
											onClick={clearSourceFilters}
											aria-pressed={selectedSourceIds.length === 0}
											className={cn(
												"md:size-auto md:min-w-[52px] md:px-2.5 md:py-1.5 md:text-xs font-medium gap-1 md:gap-0 md:rounded-md flex size-[52px] shrink-0 flex-col items-center justify-center rounded-lg border text-center text-[10px] transition-colors",
												selectedSourceIds.length === 0
													? "md:bg-foreground border-foreground/20 bg-foreground text-background"
													: "hover:bg-white/8 md:bg-[#141414] bg-[#141414]",
											)}
										>
											<span className="size-10 md:hidden border-white/15 bg-white/8 font-bold flex items-center justify-center rounded-full border text-[11px]">
												{t("filters.allSources").slice(0, 1)}
											</span>
											<span>{t("filters.allSources")}</span>
										</button>
										{sourceFilters.map((source) => (
											<button
												key={source.id}
												type="button"
												onClick={() => toggleSourceFilter(source.id)}
												title={source.name}
												className={cn(
													"md:w-auto md:min-h-0 gap-1 md:gap-1.5 px-0 md:px-2 py-0 md:py-1 md:text-xs md:flex-row md:items-center md:rounded-md md:border flex min-h-[68px] w-[64px] shrink-0 flex-col items-center rounded-lg border border-transparent text-[10px] transition-colors",
													selectedSourceIds.includes(source.id)
														? "bg-white/8 md:border-foreground/20 md:bg-foreground md:text-background text-foreground"
														: "hover:bg-white/8 md:bg-[#141414]",
												)}
												aria-pressed={selectedSourceIds.includes(source.id)}
											>
												<span
													className={cn(
														"size-11 md:size-5 flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-[#141414] transition-colors",
														selectedSourceIds.includes(source.id)
															? "md:ring-transparent ring-foreground"
															: "ring-white/10 md:ring-transparent",
													)}
												>
													<img
														alt={source.name}
														className="size-full object-cover"
														onError={(event) =>
															event.currentTarget.parentElement?.setAttribute(
																"hidden",
																"true",
															)
														}
														src={source.avatar}
													/>
												</span>
												<span className="md:w-auto md:max-w-32 md:text-left w-full truncate text-center">
													{source.name}
												</span>
											</button>
										))}
									</div>
									<div className="min-w-0 gap-1 md:hidden flex items-start">
										<div
											data-guide-target="traders"
											className="no-scrollbar min-w-0 gap-3 flex max-w-full items-start overflow-x-auto overflow-y-hidden"
										>
											<button
												type="button"
												onClick={clearSourceFilters}
												aria-pressed={selectedSourceIds.length === 0}
												className="gap-1 pt-1 flex min-h-[76px] w-[64px] shrink-0 flex-col items-center text-[10px]"
											>
												<span className="border-white/30 text-sm flex size-[52px] items-center justify-center rounded-full border-2">
													{t("filters.allSources")}
												</span>
												<span>{sourcePickerT("allTraders")}</span>
											</button>
											{sourceFilters.length === 0 ? (
												guideOpen ? (
													<div
														aria-hidden="true"
														className="gap-2 flex items-center self-center"
													>
														{[1, 2, 3, 4, 5].map((avatar) => (
															<img
																key={avatar}
																alt=""
																className="size-11 border-white/10 rounded-full border-2 object-cover"
																src={
																	avatar === 5
																		? "/images/hero-floating/onboarding-kol-5.png"
																		: `/images/hero-floating/icon-${avatar}.png`
																}
															/>
														))}
													</div>
												) : (
													<p className="text-xs self-center text-muted-foreground">
														{sourcePickerT("noMatches")}
													</p>
												)
											) : null}
											{sourceFilters.map((source) => (
												<button
													key={source.id}
													type="button"
													onClick={() => toggleSourceFilter(source.id)}
													title={source.name}
													aria-pressed={selectedSourceIds.includes(
														source.id,
													)}
													className="gap-1 px-0 pt-1 pb-0 flex min-h-[76px] w-[64px] shrink-0 flex-col items-center rounded-lg border border-transparent text-[10px] text-foreground transition-colors"
												>
													<span
														className={cn(
															"box-border flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2",
															selectedSourceIds.includes(source.id)
																? "border-white"
																: "border-white/10",
														)}
													>
														<img
															alt={source.name}
															className="size-full object-cover"
															onError={(event) =>
																event.currentTarget.parentElement?.setAttribute(
																	"hidden",
																	"true",
																)
															}
															src={source.avatar}
														/>
													</span>
													<span className="w-full truncate text-center">
														{source.name}
													</span>
												</button>
											))}
										</div>
										<Sheet
											open={isSourcePickerOpen}
											onOpenChange={setIsSourcePickerOpen}
										>
											<Button
												type="button"
												size="icon"
												variant="ghost"
												aria-label={sourcePickerT("open")}
												title={sourcePickerT("open")}
												className="size-6 text-white/40 hover:text-white/70 shrink-0 self-center bg-transparent hover:bg-transparent"
												onClick={() => setIsSourcePickerOpen(true)}
											>
												<ChevronRightIcon className="size-4 opacity-70" />
											</Button>
											<SheetContent
												side="bottom"
												showCloseButton={false}
												className="md:hidden gap-0 border-white/10 !p-0 text-white flex h-[82dvh] max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl bg-[#151515]"
											>
												<div className="mt-1 h-1 w-10 bg-white/20 mx-auto rounded-full" />
												<div className="gap-1 px-4 pt-1 pb-0 flex flex-col">
													<div className="gap-3 flex items-center">
														<div className="relative flex-1">
															<SearchIcon className="left-3 size-4 text-white/45 pointer-events-none absolute top-1/2 -translate-y-1/2" />
															<input
																value={sourcePickerQuery}
																onChange={(event) =>
																	setSourcePickerQuery(
																		event.target.value,
																	)
																}
																placeholder={sourcePickerT(
																	"search",
																)}
																className="h-11 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus-visible:ring-white/35 w-full rounded-full outline-none focus-visible:ring-1"
															/>
														</div>
													</div>
													<div className="no-scrollbar gap-2 flex overflow-x-auto">
														{SOURCE_PICKER_CATEGORIES.map(
															(category) => (
																<button
																	key={category}
																	type="button"
																	onClick={() =>
																		setSourcePickerCategory(
																			category,
																		)
																	}
																	className={cn(
																		"py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
																		sourcePickerCategory ===
																			category
																			? "border-white text-white border-b-2"
																			: "text-white/45 border-b-2 border-transparent",
																	)}
																>
																	{sourcePickerT(
																		`categories.${category}`,
																	)}
																</button>
															),
														)}
													</div>
												</div>
												<div className="min-h-0 px-4 pb-2 flex-1 overflow-y-auto">
													<div className="gap-1 flex flex-col">
														{filteredSourcePickerSources.map(
															(source) => {
																const isSelected =
																	selectedSourceIds.length ===
																		0 ||
																	selectedSourceIds.includes(
																		source.id,
																	);
																const isFollowed = (
																	followedSourceIds ?? []
																).includes(source.id);
																const sourceSignalCount =
																	visibleWebhookSignals.filter(
																		(signal) =>
																			(signal.source.id ??
																				normalizeSourceKey(
																					signal.source
																						.name,
																				)) === source.id &&
																			signal.symbol ===
																				selectedSymbol,
																	).length;

																return (
																	<div
																		key={source.id}
																		className="gap-2 px-1 flex min-h-[56px] items-center rounded-lg"
																	>
																		<button
																			type="button"
																			onClick={() =>
																				toggleSourceFilter(
																					source.id,
																				)
																			}
																			aria-pressed={
																				isSelected
																			}
																			className="min-w-0 gap-3 py-1 flex flex-1 items-center text-left"
																		>
																			<img
																				alt=""
																				className="size-10 shrink-0 rounded-full object-cover"
																				onError={(event) =>
																					event.currentTarget.setAttribute(
																						"hidden",
																						"true",
																					)
																				}
																				src={source.avatar}
																			/>
																			<span className="min-w-0 flex-1">
																				<span className="text-sm font-medium block truncate">
																					{source.name}
																				</span>
																				<span className="text-xs text-white/45 block">
																					{sourcePickerT(
																						"signalCount",
																						{
																							count: sourceSignalCount,
																						},
																					)}
																				</span>
																			</span>
																		</button>
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			aria-label={sourcePickerT(
																				isFollowed
																					? "unfollow"
																					: "follow",
																				{
																					name: source.name,
																				},
																			)}
																			className={cn(
																				"size-10 shrink-0",
																				isFollowed
																					? "text-amber-400 hover:text-amber-300"
																					: "text-white/35 hover:text-amber-300",
																			)}
																			onClick={() =>
																				toggleSourceFollow(
																					source.id,
																				)
																			}
																		>
																			<StarIcon
																				className="size-5"
																				fill={
																					isFollowed
																						? "currentColor"
																						: "none"
																				}
																			/>
																		</Button>
																	</div>
																);
															},
														)}
														{filteredSourcePickerSources.length ===
															0 && (
															<p className="py-12 text-sm text-white/45 text-center">
																{sourcePickerT("noMatches")}
															</p>
														)}
													</div>
												</div>
												<div className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),8px)]">
													<Button
														type="button"
														className="h-11 bg-white text-black hover:bg-white/90 w-full"
														onClick={() => setIsSourcePickerOpen(false)}
													>
														{sourcePickerT("done")}
													</Button>
												</div>
											</SheetContent>
										</Sheet>
									</div>
								</div>
								<div className="md:hidden flex w-full items-center">
									<Button
										data-guide-target="filters"
										type="button"
										size="icon"
										variant="ghost"
										aria-label={t("actions.filters")}
										title={t("actions.filters")}
										className="size-9 text-white/55 hover:bg-white/5 hover:text-white relative shrink-0"
										onClick={() => openMobileFilters(true)}
									>
										<SlidersHorizontalIcon className="size-4" />
										{activeMobileFilterCount > 0 && (
											<span className="right-0 top-0 size-4 font-semibold absolute flex items-center justify-center rounded-full bg-foreground text-[9px] text-background">
												{activeMobileFilterCount}
											</span>
										)}
									</Button>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										aria-label={t("actions.refresh")}
										title={t("actions.refresh")}
										className="size-9 text-white/55 hover:bg-white/5 hover:text-white"
										onClick={() => setSignalPageRefreshKey((key) => key + 1)}
									>
										<RefreshCwIcon className="size-4" />
									</Button>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										aria-label={t("guide.replay")}
										title={t("guide.replay")}
										className="size-9 text-white/55 hover:bg-white/5 hover:text-white"
										onClick={replayGuide}
									>
										<CompassIcon className="size-4" />
									</Button>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										aria-label={t(
											isChartCollapsed
												? "actions.expandChart"
												: "actions.collapseChart",
										)}
										title={t(
											isChartCollapsed
												? "actions.expandChart"
												: "actions.collapseChart",
										)}
										className="size-9 text-white/55 hover:bg-white/5 hover:text-white ml-auto"
										onClick={() =>
											setIsChartCollapsed((collapsed) => !collapsed)
										}
									>
										{isChartCollapsed ? (
											<ChevronDownIcon className="size-4" />
										) : (
											<ChevronUpIcon className="size-4" />
										)}
									</Button>
								</div>

								<div className="gap-2 md:flex md:flex-wrap md:items-center hidden">
									<div
										data-guide-target="filters"
										className="gap-2 flex w-fit max-w-full flex-wrap items-center"
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
									</div>
									<Button
										size="icon"
										variant="ghost"
										aria-label={t(
											isChartCollapsed
												? "actions.expandChart"
												: "actions.collapseChart",
										)}
										title={t(
											isChartCollapsed
												? "actions.expandChart"
												: "actions.collapseChart",
										)}
										className="size-8 text-white/55 hover:bg-white/5 hover:text-white md:size-9"
										onClick={() =>
											setIsChartCollapsed((collapsed) => !collapsed)
										}
									>
										{isChartCollapsed ? (
											<ChevronDownIcon className="size-4" />
										) : (
											<ChevronUpIcon className="size-4" />
										)}
									</Button>
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
								</div>
								<Sheet open={isMobileFiltersOpen} onOpenChange={openMobileFilters}>
									<SheetContent
										side="bottom"
										className="md:hidden gap-0 border-white/10 p-0 text-white flex h-[80dvh] max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-[#181818]"
									>
										<SheetHeader className="px-5 pt-5 pb-3 pr-14 text-left">
											<SheetTitle className="text-white text-left">
												{t("filters.mobileTitle")}
											</SheetTitle>
											<SheetDescription className="text-white/55 text-left">
												{t("filters.mobileDescription")}
											</SheetDescription>
										</SheetHeader>
										<Accordion
											type="multiple"
											defaultValue={["direction"]}
											className="min-h-0 px-5 flex-1 overflow-y-auto"
										>
											<AccordionItem
												value="direction"
												className="border-white/10"
											>
												<AccordionTrigger className="py-4 text-sm hover:no-underline">
													{t("filters.direction")}
												</AccordionTrigger>
												<AccordionContent className="pb-4">
													<div className="gap-2 flex flex-wrap">
														{SIGNAL_DIRECTIONS.map((direction) => (
															<button
																key={direction}
																type="button"
																aria-pressed={
																	draftDirection === direction
																}
																onClick={() =>
																	setDraftDirection(direction)
																}
																className={cn(
																	"min-h-10 px-4 text-sm rounded-lg border transition-colors",
																	draftDirection === direction
																		? "border-white bg-white text-black"
																		: "border-white/10 bg-white/[0.04] text-white/70",
																)}
															>
																{t(`direction.${direction}`)}
															</button>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
											<AccordionItem
												value="timeRange"
												className="border-white/10"
											>
												<AccordionTrigger className="py-4 text-sm hover:no-underline">
													{t("filters.timeRange")}
												</AccordionTrigger>
												<AccordionContent className="pb-4">
													<div className="gap-2 flex flex-wrap">
														{TIME_RANGES.map((range) => (
															<button
																key={range}
																type="button"
																aria-pressed={
																	draftTimeRange === range
																}
																onClick={() =>
																	setDraftTimeRange(range)
																}
																className={cn(
																	"min-h-10 px-4 text-sm rounded-lg border transition-colors",
																	draftTimeRange === range
																		? "border-white bg-white text-black"
																		: "border-white/10 bg-white/[0.04] text-white/70",
																)}
															>
																{t(`filters.timeRanges.${range}`)}
															</button>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
											<AccordionItem
												value="entryStatus"
												className="border-white/10"
											>
												<AccordionTrigger className="py-4 text-sm hover:no-underline">
													{t("filters.entryStatus")}
												</AccordionTrigger>
												<AccordionContent className="pb-4">
													<div className="gap-2 flex flex-wrap">
														{ENTRY_STATUSES.map((status) => (
															<button
																key={status}
																type="button"
																aria-pressed={
																	draftEntryStatus === status
																}
																onClick={() =>
																	setDraftEntryStatus(status)
																}
																className={cn(
																	"min-h-10 px-4 text-sm rounded-lg border transition-colors",
																	draftEntryStatus === status
																		? "border-white bg-white text-black"
																		: "border-white/10 bg-white/[0.04] text-white/70",
																)}
															>
																{t(
																	`filters.entryStatuses.${status}`,
																)}
															</button>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
										</Accordion>
										<div className="gap-3 border-white/10 px-5 pt-3 grid grid-cols-2 border-t bg-[#181818] pb-[max(env(safe-area-inset-bottom),16px)]">
											<Button
												type="button"
												variant="outline"
												className="h-11 border-white/15 text-white bg-transparent"
												onClick={resetMobileFilters}
											>
												{t("filters.reset")}
											</Button>
											<Button
												type="button"
												className="h-11 bg-white text-black hover:bg-white/90"
												onClick={applyMobileFilters}
											>
												{t("filters.apply")}
											</Button>
										</div>
									</SheetContent>
								</Sheet>
							</div>
						</section>

						<section
							className={cn(
								"xl:min-h-0 xl:flex-1 flex flex-col",
								isChartCollapsed && "hidden",
							)}
							data-guide-target="chart"
						>
							<div className="px-3 py-2 md:px-4 md:py-3 flex items-center justify-between bg-[#141414]">
								<div className="gap-2 md:gap-3 min-w-0 flex items-center">
									<ChartCandlestickIcon className="size-4 md:block hidden text-muted-foreground" />
									<span className="font-mono md:text-sm font-semibold text-[15px]">
										{selectedSymbol ||
											(isChartLoading
												? t("chart.loadingSymbol")
												: t("chart.emptyTitle"))}
									</span>
								</div>
								<div className="gap-1 md:gap-2 flex shrink-0 items-center">
									<div className="gap-0.5 md:p-0.5 md:rounded-md md:border md:bg-[#141414] flex items-center">
										{SUPPORTED_TIMEFRAMES.map((timeframe) => (
											<button
												key={timeframe}
												type="button"
												onClick={() => setSelectedTimeframe(timeframe)}
												className={cn(
													"min-w-8 px-1.5 py-1.5 text-xs font-semibold md:min-w-0 md:border-0 md:px-2.5 md:py-1 md:rounded-sm after:bottom-0 after:h-0.5 relative transition-colors after:absolute after:left-1/2 after:w-[45%] after:-translate-x-1/2 after:rounded-full after:bg-transparent after:content-['']",
													selectedTimeframe === timeframe
														? "md:bg-foreground md:text-background text-foreground after:bg-foreground"
														: "md:hover:bg-white/8 text-muted-foreground hover:text-foreground",
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
										className="size-8 text-white/55 hover:bg-white/5 hover:text-white md:size-9"
										onClick={() => setIsChartFullscreenOpen(true)}
									>
										<Maximize2Icon className="size-4" />
									</Button>
								</div>
							</div>

							<div
								className="md:h-[min(620px,calc(100vh-260px))] md:min-h-[420px] xl:h-auto xl:min-h-0 xl:flex-1 h-[min(280px,34dvh)] min-h-[240px]"
								style={
									guideOpen
										? {
												height: `clamp(80px, calc(100dvh - ${guideCardHeight + 200}px), 420px)`,
												minHeight: 0,
												flex: "none",
											}
										: undefined
								}
							>
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
									<div className="p-4 md:p-6 md:min-h-[520px] flex h-full min-h-[240px] items-center justify-center bg-[#141414]">
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
						data-guide-target="signalList"
						style={
							guideOpen
								? {
										alignSelf: "start",
										maxHeight: `calc(100dvh - ${guideCardHeight + 100}px)`,
										overflowY: "auto",
									}
								: undefined
						}
						className={cn(
							"group min-h-0 xl:flex xl:flex-col xl:overflow-hidden xl:border-l xl:border-t-0 relative bg-[#141414]",
						)}
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

						<div className={cn("shrink-0", isSignalPanelCollapsed && "xl:hidden")}>
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
											const filters: SignalPageFilters = {
												...signalPageFilters,
												status,
											};
											const nextSignal = signals.find((signal) =>
												doesTradeSignalMatchFilters(signal, filters),
											);
											setActiveSignalId(nextSignal?.id ?? null);
										}}
										className={cn(
											"gap-1.5 px-4 py-2.5 text-sm font-medium after:h-0.5 after:w-9 relative transition-colors after:absolute after:bottom-[-1px] after:left-1/2 after:-translate-x-1/2 after:content-['']",
											selectedStatus === status
												? "text-white after:bg-white"
												: "hover:text-white/75 text-white/45 after:bg-transparent",
										)}
									>
										<span>{t(`status.${status}`)}</span>
										{displayedStatusCounts[status] > 0 && (
											<span className="ml-1.5 text-xs font-semibold opacity-60">
												{displayedStatusCounts[status]}
											</span>
										)}
									</button>
								))}
							</div>
						</div>

						<div
							className={cn(
								"divide-white/[0.08] px-5 py-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:p-3 divide-y",
								isSignalPanelCollapsed && "xl:hidden",
							)}
						>
							{!hasProAccess ? (
								preview.signals.length ? (
									<div className="divide-white/[0.08] divide-y">
										{preview.signals.slice(0, 3).map((signal, index) => (
											<article
												key={`${signal.sourceName}-${signal.symbol}-${signal.submittedAt}-${index}`}
												className="p-3"
											>
												<div className="gap-2 flex items-center">
													<img
														alt=""
														className="size-8 rounded-full object-cover"
														src={
															signal.avatarUrl ??
															getProfileAvatarUrlForSeed(
																signal.sourceName,
																80,
															)
														}
													/>
													<div className="min-w-0 flex-1">
														<p className="text-sm font-semibold truncate">
															{signal.sourceName}
														</p>
														<p className="text-xs text-muted-foreground">
															{signal.symbol} ·{" "}
															{t(`direction.${signal.direction}`)}
														</p>
													</div>
													<span className="text-xs text-muted-foreground">
														{t(`status.${signal.status}`)}
													</span>
												</div>
												<p className="mt-2 text-xs text-muted-foreground">
													{t("signalsPanel.submittedAt")}:{" "}
													{formatSignalSubmittedAt(
														signal.submittedAt,
														locale,
													)}
												</p>
											</article>
										))}
									</div>
								) : isSignalPageLoading ? (
									<div className="p-5 text-sm text-muted-foreground">
										{t("signalsPanel.loadingTitle")}
									</div>
								) : (
									<div className="p-5 text-sm text-muted-foreground">
										{t("signalsPanel.emptyTitle")}
									</div>
								)
							) : isSignalPageLoading && !filteredSignals.length ? (
								<div className="p-6 rounded-md border border-dashed text-center">
									<p className="font-medium">{t("signalsPanel.loadingTitle")}</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{t("signalsPanel.loadingDescription")}
									</p>
								</div>
							) : filteredSignals.length ? (
								<>
									{filteredSignals.map((signal) => {
										const statusPresentation = getSignalStatusPresentation(
											signal,
											{
												closed: t("signalsPanel.closed"),
												entered: t("signalsPanel.entered"),
												expectedRr: t("signalsPanel.expectedRr"),
												pending: t("signalsPanel.pending"),
												result: t("signalsPanel.result"),
											},
										);
										const StatusIcon = statusPresentation.icon;

										return (
											<button
												key={signal.id}
												type="button"
												onClick={() => focusSignal(signal)}
												className={cn(
													"p-3 hover:bg-white/5 w-full bg-[#141414] text-left transition-colors",
													signal.id === activeSignal?.id &&
														"bg-white/5 rounded-xl",
												)}
											>
												<div className="mb-3 gap-2 grid grid-cols-[minmax(0,1fr)_auto] items-start">
													<div className="min-w-0 gap-2 flex items-center">
														<span className="size-8 flex shrink-0 items-center justify-center overflow-hidden rounded-full">
															<img
																alt={signal.sourceName}
																className="size-8 object-cover"
																onError={(event) =>
																	event.currentTarget.parentElement?.setAttribute(
																		"hidden",
																		"true",
																	)
																}
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
																·{" "}
																{t(`direction.${signal.direction}`)}
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
	onHeightChange: (height: number) => void;
	isAuthenticated: boolean;
	requiresMembership: boolean;
	step: SignalsGuideStep;
	stepIndex: number;
	totalSteps: number;
	onClose: () => void;
	onNext: () => void;
}

function SignalsGuideOverlay({
	onHeightChange,
	isAuthenticated,
	requiresMembership,
	step,
	stepIndex,
	totalSteps,
	onClose,
	onNext,
}: SignalsGuideOverlayProps) {
	const t = useTranslations("signals.guide");
	const isLastStep = stepIndex === totalSteps - 1;
	const [targetRect, setTargetRect] = useState<GuideTargetRect | null>(null);
	const [viewportSize, setViewportSize] = useState<GuideViewportSize>({
		height: 0,
		width: 0,
	});
	const cardRef = useRef<HTMLDivElement>(null);
	const [cardSize, setCardSize] = useState({ width: 360, height: 240 });
	const cardWidth = Math.min(400, Math.max(0, viewportSize.width - 40));
	const gap = 28;
	const margin = 20;
	const centeredLeft = targetRect
		? clampNumber(
				targetRect.left + (targetRect.width - cardWidth) / 2,
				margin,
				viewportSize.width - cardWidth - margin,
			)
		: margin;
	const placements = targetRect
		? [
				{ left: centeredLeft, top: targetRect.bottom + gap },
				{ left: centeredLeft, top: targetRect.top - cardSize.height - gap },
				{
					left: targetRect.right + gap,
					top: clampNumber(
						targetRect.top,
						margin,
						viewportSize.height - cardSize.height - margin,
					),
				},
				{
					left: targetRect.left - cardWidth - gap,
					top: clampNumber(
						targetRect.top,
						margin,
						viewportSize.height - cardSize.height - margin,
					),
				},
			]
		: [];
	const placement = placements.find(
		({ left, top }) =>
			left >= margin &&
			top >= margin &&
			left + cardWidth <= viewportSize.width - margin &&
			top + cardSize.height <= viewportSize.height - margin,
	);
	const cardStyle: CSSProperties = {
		left: placement?.left ?? margin,
		top: placement?.top ?? margin,
		width: cardWidth || "calc(100vw - 40px)",
		maxHeight: "48dvh",
		overflowY: "auto",
		visibility: targetRect && placement ? "visible" : "hidden",
	};

	useEffect(() => {
		const card = cardRef.current;
		if (!card) return;
		function measureCard() {
			const rect = card!.getBoundingClientRect();
			setCardSize({ width: rect.width, height: Math.ceil(rect.height) });
			onHeightChange(Math.ceil(rect.height));
		}
		measureCard();
		const observer = new ResizeObserver(measureCard);
		observer.observe(card);
		return () => observer.disconnect();
	}, [onHeightChange]);

	useEffect(() => {
		let frame = 0;
		let measureTimer = 0;

		function measureTarget() {
			setViewportSize({
				height: window.innerHeight,
				width: window.innerWidth,
			});

			const targetElement = getGuideTargetElement(step.target);

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

		const targetElement = getGuideTargetElement(step.target);

		function alignTarget() {
			const preview = document.querySelector<HTMLElement>("[data-guide-viewport]");
			const visibleTarget = getGuideTargetElement(step.target);
			if (!visibleTarget || !preview) return;
			const rect = visibleTarget.getBoundingClientRect();
			preview.scrollBy({
				top: rect.top - Math.max(24, preview.getBoundingClientRect().top + 16),
				behavior: "instant",
			});
			scheduleMeasure();
		}
		alignTarget();

		const observer = new ResizeObserver(alignTarget);
		if (targetElement) observer.observe(targetElement);
		const preview = document.querySelector("[data-guide-viewport]");
		if (preview) observer.observe(preview);
		measureTimer = window.setTimeout(alignTarget, 180);
		scheduleMeasure();

		window.addEventListener("resize", alignTarget);
		window.addEventListener("scroll", scheduleMeasure, true);

		return () => {
			observer.disconnect();
			window.clearTimeout(measureTimer);
			window.cancelAnimationFrame(frame);
			window.removeEventListener("resize", alignTarget);
			window.removeEventListener("scroll", scheduleMeasure, true);
		};
	}, [step.target]);

	return (
		<div className="inset-0 fixed z-50" role="dialog" aria-modal="true" aria-label={step.title}>
			{targetRect ? (
				<>
					<div
						className="bg-black/40 backdrop-blur-sm absolute"
						style={{
							height: targetRect.top,
							left: 0,
							right: 0,
							top: 0,
						}}
					/>
					<div
						className="bg-black/40 backdrop-blur-sm absolute"
						style={{
							bottom: 0,
							left: 0,
							right: 0,
							top: targetRect.bottom,
						}}
					/>
					<div
						className="bg-black/40 backdrop-blur-sm absolute"
						style={{
							bottom: viewportSize.height - targetRect.bottom,
							left: 0,
							top: targetRect.top,
							width: targetRect.left,
						}}
					/>
					<div
						className="bg-black/40 backdrop-blur-sm absolute"
						style={{
							bottom: viewportSize.height - targetRect.bottom,
							left: targetRect.right,
							right: 0,
							top: targetRect.top,
						}}
					/>
					<div
						data-guide-highlight="true"
						data-guide-highlight-target={step.target}
						className="border-emerald-300/80 absolute rounded-xl border shadow-[0_0_18px_rgba(110,231,183,0.16)]"
						style={{
							height: targetRect.height,
							left: targetRect.left,
							top: targetRect.top,
							width: targetRect.width,
						}}
					/>
				</>
			) : (
				<div className="inset-0 bg-black/40 backdrop-blur-sm absolute" />
			)}
			{targetRect && placement ? (
				<div
					aria-hidden="true"
					className="bg-emerald-200/70 pointer-events-none absolute"
					style={
						placement.top >= targetRect.bottom ||
						placement.top + cardSize.height <= targetRect.top
							? {
									left: clampNumber(
										placement.left + cardWidth / 2,
										targetRect.left + 8,
										targetRect.right - 8,
									),
									top:
										placement.top >= targetRect.bottom
											? targetRect.bottom
											: placement.top + cardSize.height,
									width: 1,
									height: gap - 4,
								}
							: {
									left:
										placement.left >= targetRect.right
											? targetRect.right
											: placement.left + cardWidth,
									top: clampNumber(
										placement.top + cardSize.height / 2,
										targetRect.top + 8,
										targetRect.bottom - 8,
									),
									width: gap - 4,
									height: 1,
								}
					}
				/>
			) : null}
			<div
				ref={cardRef}
				data-guide-card="true"
				className="px-1 py-2 text-white pointer-events-auto absolute [text-shadow:0_2px_10px_rgba(0,0,0,0.8)]"
				style={cardStyle}
			>
				<p className="text-xs font-medium text-white/60">
					{t("stepCounter", { current: stepIndex + 1, total: totalSteps })}
				</p>
				<h2 className="mt-2 text-lg font-semibold leading-snug">{step.title}</h2>
				<p className="mt-2 text-sm leading-6 text-white/80">
					{step.target === "filters" && viewportSize.width < 768
						? t("steps.filters.mobileDescription")
						: step.description}
				</p>

				<div className="mt-4 gap-2 flex flex-wrap justify-end">
					{!isAuthenticated ? (
						<Button asChild type="button" variant="ghost" size="sm">
							<Link href="/login?redirectTo=%2Fsignals">{t("login")}</Link>
						</Button>
					) : null}
					{!requiresMembership || !isLastStep ? (
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							{requiresMembership ? t("viewPlans") : t("close")}
						</Button>
					) : null}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="border-white/70 text-white hover:bg-white/10 bg-transparent"
						onClick={onNext}
					>
						{isLastStep
							? requiresMembership
								? t("viewPlans")
								: t("finish")
							: t("next")}
					</Button>
				</div>
			</div>
		</div>
	);
}
