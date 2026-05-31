"use client";

import { Button, cn } from "@repo/ui";
import type { UTCTimestamp } from "lightweight-charts";
import {
	BellIcon,
	ChartCandlestickIcon,
	CheckCircle2Icon,
	Clock3Icon,
	Maximize2Icon,
	RadioIcon,
	RefreshCwIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	TrendingDownIcon,
	TrendingUpIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import type { SignalChartSignal } from "./TradingViewSignalChart";
import { TradingViewSignalChart } from "./TradingViewSignalChart";

const SUPPORTED_TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
const SIGNAL_DIRECTIONS = ["all", "long", "short"] as const;
const SIGNAL_STATUSES = ["active", "history"] as const;

type Timeframe = (typeof SUPPORTED_TIMEFRAMES)[number];
type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];
type SignalStatus = (typeof SIGNAL_STATUSES)[number];

interface Instrument {
	symbol: string;
	base: string;
	price: number;
	change: number;
	volume: string;
	accent: string;
	logo: string;
}

interface Source {
	id: string;
	name: string;
	handle: string;
	initials: string;
	accent: string;
	avatar: string;
}

interface Candle {
	close: number;
	high: number;
	low: number;
	open: number;
	time: UTCTimestamp;
}

interface TradeSignal {
	id: string;
	symbol: string;
	sourceId: string;
	sourceName: string;
	avatarLabel: string;
	avatarUrl: string;
	direction: Exclude<SignalDirection, "all">;
	status: SignalStatus;
	entry: number;
	takeProfit: number;
	stopLoss: number;
	submittedAt: string;
	confidence: number;
	x: number;
	y: number;
	outcome?: string;
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

const SOURCES: Source[] = [
	{
		id: "xinsuo",
		name: "所长",
		handle: "@SignalLab",
		initials: "所",
		accent: "bg-sky-500",
		avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGI_400x400.jpg",
	},
	{
		id: "feiyang",
		name: "飞扬",
		handle: "@Momentum",
		initials: "飞",
		accent: "bg-emerald-500",
		avatar: "https://pbs.twimg.com/profile_images/1648376978935726081/L0LwFYFX_400x400.jpg",
	},
	{
		id: "shanzhiwang",
		name: "山寨之王",
		handle: "@AltScout",
		initials: "山",
		accent: "bg-amber-500",
		avatar: "https://pbs.twimg.com/profile_images/1706963shotgun/1706963_400x400.jpg",
	},
	{
		id: "wangbot",
		name: "WG Bot",
		handle: "@Quant",
		initials: "WG",
		accent: "bg-stone-500",
		avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=wgbot&backgroundColor=374151",
	},
];

const SIGNALS: TradeSignal[] = [
	{
		id: "btc-1",
		symbol: "BTCUSDT",
		sourceId: "xinsuo",
		sourceName: "所长",
		avatarLabel: "所",
		avatarUrl: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGI_400x400.jpg",
		direction: "long",
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
		avatarUrl: "https://pbs.twimg.com/profile_images/1648376978935726081/L0LwFYFX_400x400.jpg",
		direction: "long",
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
		avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=shanzhiwang&backgroundColor=f59e0b",
		direction: "long",
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
		avatarUrl: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGI_400x400.jpg",
		direction: "short",
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
		avatarUrl: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGI_400x400.jpg",
		direction: "long",
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
		avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=wgbot&backgroundColor=374151",
		direction: "short",
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
		avatarUrl: "https://pbs.twimg.com/profile_images/1648376978935726081/L0LwFYFX_400x400.jpg",
		direction: "long",
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
		avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=shanzhiwang&backgroundColor=f59e0b",
		direction: "short",
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
];

const MARKET_SEED: Record<string, number> = {
	BTCUSDT: 69_300,
	ETHUSDT: 2_875,
	SOLUSDT: 87.5,
};

function buildCandles(symbol: string, timeframe: Timeframe): Candle[] {
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

function getSelectedSignal(signals: TradeSignal[], activeSignalId: string | null) {
	return signals.find((signal) => signal.id === activeSignalId) ?? signals[0] ?? null;
}

export function SignalsWorkspace() {
	const t = useTranslations("signals");
	const locale = useLocale();
	const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
	const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("1h");
	const [selectedSource, setSelectedSource] = useState("all");
	const [selectedDirection, setSelectedDirection] = useState<SignalDirection>("all");
	const [selectedStatus, setSelectedStatus] = useState<SignalStatus>("active");
	const [activeSignalId, setActiveSignalId] = useState<string | null>("btc-1");

	const candles = useMemo(
		() => buildCandles(selectedSymbol, selectedTimeframe),
		[selectedSymbol, selectedTimeframe],
	);

	const filteredSignals = useMemo(
		() =>
			SIGNALS.filter((signal) => {
				return (
					signal.symbol === selectedSymbol &&
					signal.status === selectedStatus &&
					(selectedSource === "all" || signal.sourceId === selectedSource) &&
					(selectedDirection === "all" || signal.direction === selectedDirection)
				);
			}),
		[selectedDirection, selectedSource, selectedStatus, selectedSymbol],
	);

	const activeSignal = getSelectedSignal(filteredSignals, activeSignalId);
	const selectedInstrument =
		INSTRUMENTS.find((instrument) => instrument.symbol === selectedSymbol) ?? INSTRUMENTS[0];
	function formatPrice(value: number, fractionDigits = selectedSymbol === "SOLUSDT" ? 2 : 0) {
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
		const nextSignal = SIGNALS.find(
			(signal) =>
				signal.symbol === symbol &&
				signal.status === selectedStatus &&
				(selectedSource === "all" || signal.sourceId === selectedSource),
		);
		setActiveSignalId(nextSignal?.id ?? null);
	}

	return (
		<div className="min-h-full bg-[#141414] text-foreground">
			<header className="px-4 py-2 backdrop-blur border-b bg-[#141414]/80">
				<div className="min-w-0 gap-3 no-scrollbar flex items-center overflow-x-auto">
					<div className="gap-2 pr-3 text-sm font-semibold flex shrink-0 items-center">
						<RadioIcon className="size-4 text-emerald-500" />
						<span>{t("ticker.live")}</span>
					</div>
					{INSTRUMENTS.map((instrument) => (
						<button
							key={instrument.symbol}
							type="button"
							onClick={() => selectSymbol(instrument.symbol)}
							className={cn(
								"gap-2 px-3 py-1.5 text-sm flex shrink-0 items-center rounded-md border text-left transition-colors hover:bg-white/8",
								selectedSymbol === instrument.symbol
									? "border-foreground/20 bg-white/8"
									: "border-transparent bg-transparent",
							)}
						>
							<span className="size-5 flex shrink-0 items-center justify-center rounded-full overflow-hidden bg-black">
								<img
									alt={instrument.base}
									className="size-6 object-contain"
									src={instrument.logo}
								/>
							</span>
							<span className="font-semibold">{instrument.base}</span>
							<span className="font-mono text-muted-foreground">
								$
								{formatPrice(
									instrument.price,
									instrument.symbol === "SOLUSDT" ? 2 : 0,
								)}
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

			<div className="gap-0 lg:h-[calc(100vh-121px)] xl:grid-cols-[minmax(700px,1fr)_328px] grid min-h-[760px] grid-cols-1">
				<aside className="xl:border-r xl:border-b-0 border-b bg-[#141414] hidden">
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
						{INSTRUMENTS.map((instrument) => {
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
					<section className="px-4 py-3 border-b bg-[#141414]">
						<div className="gap-3 flex flex-col">
							<div className="gap-2 flex flex-wrap items-center">
								<button
									type="button"
									onClick={() => setSelectedSource("all")}
									className={cn(
										"px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
										selectedSource === "all"
											? "border-foreground/20 bg-foreground text-background"
											: "bg-[#141414] hover:bg-white/8",
									)}
								>
									{t("filters.allSources")}
								</button>
								{SOURCES.map((source) => (
									<button
										key={source.id}
										type="button"
										onClick={() => setSelectedSource(source.id)}
										className={cn(
											"gap-1.5 px-2 py-1 text-xs flex items-center rounded-md border transition-colors",
											selectedSource === source.id
												? "border-foreground/20 bg-foreground text-background"
												: "bg-[#141414] hover:bg-white/8",
										)}
									>
										<span className="size-5 flex shrink-0 items-center justify-center rounded-full overflow-hidden">
											<img
												alt={source.name}
												className="size-5 object-cover"
												onError={(e) => {
													const target = e.currentTarget;
													target.style.display = "none";
													const next = target.nextElementSibling as HTMLElement | null;
													if (next) next.style.display = "flex";
												}}
												src={source.avatar}
											/>
											<span
												className={cn(
													"size-5 font-bold text-white hidden items-center justify-center rounded-full text-[9px]",
													source.accent,
												)}
												style={{ display: "none" }}
											>
												{source.initials}
											</span>
										</span>
										{source.name}
									</button>
								))}
							</div>

							<div className="gap-2 flex flex-wrap items-center">
								<div className="gap-1 p-1 flex items-center rounded-md border bg-[#141414]">
									{SIGNAL_DIRECTIONS.map((direction) => (
										<button
											key={direction}
											type="button"
											onClick={() => setSelectedDirection(direction)}
											className={cn(
												"gap-1 px-3 py-1.5 text-xs font-semibold flex items-center rounded-sm transition-colors",
												selectedDirection === direction
													? "bg-foreground text-background"
													: "text-muted-foreground hover:bg-white/8 hover:text-foreground",
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
								</div>

								<div className="gap-1 p-1 flex items-center rounded-md border bg-[#141414]">
									{SUPPORTED_TIMEFRAMES.map((timeframe) => (
										<button
											key={timeframe}
											type="button"
											onClick={() => setSelectedTimeframe(timeframe)}
											className={cn(
												"px-3 py-1.5 text-xs font-semibold rounded-sm transition-colors",
												selectedTimeframe === timeframe
													? "bg-foreground text-background"
													: "text-muted-foreground hover:bg-white/8 hover:text-foreground",
											)}
										>
											{timeframe}
										</button>
									))}
								</div>

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

					<section className="min-h-0 flex flex-1 flex-col">
						<div className="px-4 py-3 flex items-center justify-between border-b bg-[#141414]">
							<div className="gap-2 flex items-center">
								<ChartCandlestickIcon className="size-4 text-muted-foreground" />
								<span className="font-mono text-sm font-semibold">
									{selectedSymbol}
								</span>
								<span className="text-sm text-muted-foreground">
									{selectedTimeframe}
								</span>
							</div>
							<div className="gap-1 flex items-center">
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

						<div className="min-h-0 flex-1">
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
								signals={filteredSignals}
								symbol={selectedSymbol}
								timeframe={selectedTimeframe}
							/>
						</div>
					</section>
				</main>

				<aside className="xl:border-t-0 xl:border-l border-t bg-[#141414]">
					<div className="grid grid-cols-2 border-b">
						{SIGNAL_STATUSES.map((status) => (
							<button
								key={status}
								type="button"
								onClick={() => {
									setSelectedStatus(status);
									const nextSignal = SIGNALS.find(
										(signal) =>
											signal.symbol === selectedSymbol &&
											signal.status === status &&
											(selectedSource === "all" ||
												signal.sourceId === selectedSource),
									);
									setActiveSignalId(nextSignal?.id ?? null);
								}}
								className={cn(
									"px-3 py-4 text-sm font-semibold border-b-2 transition-colors",
									selectedStatus === status
										? "border-foreground text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								{t(`status.${status}`)}
							</button>
						))}
					</div>

					<div className="px-4 py-3 flex items-center justify-between border-b">
						<div>
							<p className="text-xs text-muted-foreground">
								{t("signalsPanel.eyebrow")}
							</p>
							<h2 className="font-semibold">{t("signalsPanel.title")}</h2>
						</div>
						<span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-white/8">
							{filteredSignals.length}
						</span>
					</div>

					<div className="space-y-3 p-3 max-h-[680px] overflow-y-auto">
						{filteredSignals.length ? (
							filteredSignals.map((signal) => (
								<button
									key={signal.id}
									type="button"
									onClick={() => focusSignal(signal)}
									className={cn(
										"p-3 w-full rounded-xl border border-white/5 bg-[#141414] text-left transition-colors hover:bg-white/5",
										signal.id === activeSignal?.id &&
											"border-white/10 bg-white/5",
									)}
								>
									<div className="mb-3 gap-3 flex items-center justify-between">
										<div className="min-w-0 gap-2 flex items-center">
											<span className="size-8 flex shrink-0 items-center justify-center rounded-full overflow-hidden">
												<img
													alt={signal.sourceName}
													className="size-8 object-cover"
													onError={(e) => {
														const target = e.currentTarget;
														target.style.display = "none";
														const next = target.nextElementSibling as HTMLElement | null;
														if (next) next.style.display = "flex";
													}}
													src={signal.avatarUrl}
												/>
												<span
													className={cn(
														"size-8 text-xs font-bold text-white hidden items-center justify-center rounded-full",
														signal.direction === "long"
															? "bg-emerald-500"
															: "bg-rose-500",
													)}
													style={{ display: "none" }}
												>
													{signal.avatarLabel}
												</span>
											</span>
											<div className="min-w-0">
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
												"px-2 py-1 font-semibold text-white rounded-full text-[11px]",
												signal.status === "active"
													? "bg-emerald-500"
													: "bg-amber-500",
											)}
										>
											{signal.status === "active"
												? t("signalsPanel.entered")
												: (signal.outcome ?? t("signalsPanel.closed"))}
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
											{signal.status === "active" ? (
												<CheckCircle2Icon className="size-3.5 text-emerald-500" />
											) : (
												<Clock3Icon className="size-3.5 text-amber-500" />
											)}
											{t("signalsPanel.expectedRr")}
										</span>
										<span className="font-mono font-semibold text-emerald-500">
											{signal.confidence.toFixed(2)}
										</span>
									</div>
								</button>
							))
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
