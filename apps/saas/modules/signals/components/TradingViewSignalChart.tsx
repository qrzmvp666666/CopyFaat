"use client";

import { cn } from "@repo/ui";
import {
	CandlestickSeries,
	ColorType,
	CrosshairMode,
	LineStyle,
	createChart,
} from "lightweight-charts";
import type {
	AutoscaleInfoProvider,
	CandlestickData,
	IChartApi,
	IPriceLine,
	ISeriesApi,
	Time,
	UTCTimestamp,
} from "lightweight-charts";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface TradingViewSignalChartProps {
	activeSignal: SignalChartSignal | null;
	candles: SignalChartCandle[];
	className?: string;
	formatPrice: (value: number, fractionDigits?: number) => string;
	labels: PriceLineLabels;
	locale: string;
	onSelectSignal: (signal: SignalChartSignal) => void;
	signals: SignalChartSignal[];
	symbol: string;
	timeframe: string;
}

interface SignalChartCandle extends CandlestickData<UTCTimestamp> {}

export interface SignalChartSignal {
	avatarLabel: string;
	avatarUrl: string;
	direction: "long" | "short";
	entry: number;
	entryStatus: "entered" | "pending";
	id: string;
	sourceName: string;
	stopLoss: number;
	submittedAtTime?: UTCTimestamp;
	symbol: string;
	takeProfit: number;
	x: number;
}

interface PriceLineLabels {
	entry: string;
	stopLoss: string;
	takeProfit: string;
}

interface MarkerPosition {
	left: number;
	signal: SignalChartSignal;
	top: number;
}

const CHART_BACKGROUND = "#141414";
const CHART_GRID = "rgba(255, 255, 255, 0.05)";
const CHART_TEXT = "#9ca3af";
const UP_COLOR = "#de5b52";
const DOWN_COLOR = "#51a59b";
const PROFIT_COLOR = "#26a69a";
const RISK_COLOR = "#ef5350";
const ENTRY_COLOR = "#f59e0b";

function getSignalCandleIndex(signal: SignalChartSignal, candlesLength: number) {
	return Math.min(
		candlesLength - 1,
		Math.max(0, Math.round((signal.x / 100) * (candlesLength - 1))),
	);
}

function getNearestSignalCandle(signal: SignalChartSignal, candles: SignalChartCandle[]) {
	if (!signal.submittedAtTime || candles.length === 0) {
		return candles[getSignalCandleIndex(signal, candles.length)];
	}

	const firstCandle = candles[0];
	const lastCandle = candles[candles.length - 1];

	if (
		firstCandle &&
		lastCandle &&
		(signal.submittedAtTime < Number(firstCandle.time) ||
			signal.submittedAtTime > Number(lastCandle.time))
	) {
		return candles[getSignalCandleIndex(signal, candles.length)];
	}

	let nearest = candles[0];
	let nearestDistance = Math.abs(Number(nearest.time) - signal.submittedAtTime);

	for (const candle of candles) {
		const distance = Math.abs(Number(candle.time) - signal.submittedAtTime);

		if (distance < nearestDistance) {
			nearest = candle;
			nearestDistance = distance;
		}
	}

	return nearest;
}

function getPricePrecision(symbol: string) {
	return symbol === "SOLUSDT" ? 2 : 0;
}

function getMinMove(symbol: string) {
	return symbol === "SOLUSDT" ? 0.01 : 1;
}

function getProfitPrice(signal: SignalChartSignal) {
	return signal.direction === "long" ? signal.takeProfit : signal.stopLoss;
}

function getRiskPrice(signal: SignalChartSignal) {
	return signal.direction === "long" ? signal.stopLoss : signal.takeProfit;
}

function getSignalPriceRange(signals: SignalChartSignal[]) {
	const prices = signals.flatMap((signal) => [signal.entry, signal.takeProfit, signal.stopLoss]);
	const validPrices = prices.filter((price) => Number.isFinite(price) && price > 0);

	if (!validPrices.length) {
		return null;
	}

	return {
		maxValue: Math.max(...validPrices),
		minValue: Math.min(...validPrices),
	};
}

export function TradingViewSignalChart({
	activeSignal,
	candles,
	className,
	formatPrice,
	labels,
	locale,
	onSelectSignal,
	signals,
	symbol,
	timeframe,
}: TradingViewSignalChartProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
	const priceLinesRef = useRef<IPriceLine[]>([]);
	const latestSignalsRef = useRef(signals);
	const latestCandlesRef = useRef(candles);
	const [markerPositions, setMarkerPositions] = useState<MarkerPosition[]>([]);
	const pricePrecision = getPricePrecision(symbol);

	const autoscaleInfoProvider = useCallback<AutoscaleInfoProvider>(
		(original) => {
			const base = original();
			const signalRange = getSignalPriceRange(latestSignalsRef.current);

			if (!base?.priceRange || !signalRange) {
				return base;
			}

			const minValue = Math.min(base.priceRange.minValue, signalRange.minValue);
			const maxValue = Math.max(base.priceRange.maxValue, signalRange.maxValue);
			const padding = Math.max((maxValue - minValue) * 0.08, getMinMove(symbol) * 6);

			return {
				...base,
				priceRange: {
					maxValue: maxValue + padding,
					minValue: Math.max(0, minValue - padding),
				},
			};
		},
		[symbol],
	);

	const chartData = useMemo(
		() =>
			candles.map((candle) => ({
				close: candle.close,
				high: candle.high,
				low: candle.low,
				open: candle.open,
				time: candle.time,
			})),
		[candles],
	);

	const updateMarkerPositions = useCallback(() => {
		const chart = chartRef.current;
		const series = seriesRef.current;

		if (!chart || !series) {
			return;
		}

		const nextPositions = latestSignalsRef.current.flatMap((signal) => {
			const candle = getNearestSignalCandle(signal, latestCandlesRef.current);

			if (!candle) {
				return [];
			}

			const left = chart.timeScale().timeToCoordinate(candle.time);
			const top = series.priceToCoordinate(signal.entry);

			if (left === null || top === null) {
				return [];
			}

			return [{ left, signal, top }];
		});

		setMarkerPositions(nextPositions);
	}, []);

	useEffect(() => {
		latestSignalsRef.current = signals;
		latestCandlesRef.current = candles;
		window.requestAnimationFrame(updateMarkerPositions);
	}, [candles, signals, updateMarkerPositions]);

	useEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		const chart = createChart(container, {
			autoSize: true,
			crosshair: {
				mode: CrosshairMode.Normal,
			},
			grid: {
				horzLines: {
					color: CHART_GRID,
				},
				vertLines: {
					color: CHART_GRID,
				},
			},
			layout: {
				attributionLogo: true,
				background: {
					color: CHART_BACKGROUND,
					type: ColorType.Solid,
				},
				fontFamily:
					"var(--font-sans), Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
				fontSize: 13,
				textColor: CHART_TEXT,
			},
			localization: {
				locale,
				priceFormatter: (price: number) => formatPrice(price, pricePrecision),
			},
			rightPriceScale: {
				borderColor: "rgba(255, 255, 255, 0.12)",
				scaleMargins: {
					bottom: 0.08,
					top: 0.08,
				},
				visible: true,
			},
			timeScale: {
				barSpacing: 7,
				borderColor: "rgba(255, 255, 255, 0.12)",
				rightOffset: 12,
				secondsVisible: false,
				timeVisible: true,
			},
		});

		const series = chart.addSeries(CandlestickSeries, {
			autoscaleInfoProvider,
			borderVisible: false,
			downColor: DOWN_COLOR,
			priceFormat: {
				minMove: getMinMove(symbol),
				precision: pricePrecision,
				type: "price",
			},
			priceLineColor: "rgba(255,255,255,0.2)",
			priceLineStyle: LineStyle.Dashed,
			priceLineWidth: 1,
			upColor: UP_COLOR,
			wickDownColor: DOWN_COLOR,
			wickUpColor: UP_COLOR,
		});

		chartRef.current = chart;
		seriesRef.current = series;

		const resizeObserver = new ResizeObserver(() => {
			window.requestAnimationFrame(updateMarkerPositions);
		});
		resizeObserver.observe(container);

		const handleRangeChange = () => updateMarkerPositions();
		chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

		return () => {
			chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
			resizeObserver.disconnect();
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			priceLinesRef.current = [];
		};
	}, [autoscaleInfoProvider, formatPrice, locale, pricePrecision, symbol, updateMarkerPositions]);

	useEffect(() => {
		const chart = chartRef.current;
		const series = seriesRef.current;

		if (!chart || !series) {
			return;
		}

		chart.applyOptions({
			localization: {
				locale,
				priceFormatter: (price: number) => formatPrice(price, pricePrecision),
			},
			timeScale: {
				barSpacing: 7,
				rightOffset: 12,
			},
		});
		series.applyOptions({
			autoscaleInfoProvider,
			priceFormat: {
				minMove: getMinMove(symbol),
				precision: pricePrecision,
				type: "price",
			},
		});
		series.setData(chartData);

		const from = Math.max(0, chartData.length - 110);
		chart.timeScale().setVisibleLogicalRange({
			from,
			to: chartData.length + 8,
		});

		window.requestAnimationFrame(updateMarkerPositions);
	}, [
		autoscaleInfoProvider,
		chartData,
		formatPrice,
		locale,
		pricePrecision,
		symbol,
		updateMarkerPositions,
	]);

	useEffect(() => {
		const chart = chartRef.current;
		const series = seriesRef.current;

		if (!chart || !series) {
			return;
		}

		for (const line of priceLinesRef.current) {
			series.removePriceLine(line);
		}

		priceLinesRef.current = [];

		if (activeSignal) {
			priceLinesRef.current = [
				series.createPriceLine({
					axisLabelColor: ENTRY_COLOR,
					axisLabelTextColor: "#111111",
					axisLabelVisible: true,
					color: ENTRY_COLOR,
					lineStyle: LineStyle.Dotted,
					lineVisible: true,
					lineWidth: 1,
					price: activeSignal.entry,
					title: `${labels.entry} ${formatPrice(activeSignal.entry, pricePrecision)}`,
				}),
				series.createPriceLine({
					axisLabelColor: PROFIT_COLOR,
					axisLabelTextColor: "#111111",
					axisLabelVisible: true,
					color: PROFIT_COLOR,
					lineStyle: LineStyle.Dotted,
					lineVisible: true,
					lineWidth: 1,
					price: getProfitPrice(activeSignal),
					title: `${labels.takeProfit} ${formatPrice(getProfitPrice(activeSignal), pricePrecision)}`,
				}),
				series.createPriceLine({
					axisLabelColor: RISK_COLOR,
					axisLabelTextColor: "#ffffff",
					axisLabelVisible: true,
					color: RISK_COLOR,
					lineStyle: LineStyle.Dotted,
					lineVisible: true,
					lineWidth: 1,
					price: getRiskPrice(activeSignal),
					title: `${labels.stopLoss} ${formatPrice(getRiskPrice(activeSignal), pricePrecision)}`,
				}),
			];

			const index = getSignalCandleIndex(activeSignal, candles.length);
			const activeCandle = getNearestSignalCandle(activeSignal, candles);
			const nearestIndex = activeCandle ? candles.indexOf(activeCandle) : index;
			chart.timeScale().setVisibleLogicalRange({
				from: Math.max(0, nearestIndex - 72),
				to: Math.min(candles.length + 10, nearestIndex + 26),
			});
		}

		window.requestAnimationFrame(updateMarkerPositions);
	}, [
		activeSignal,
		candles.length,
		formatPrice,
		labels.entry,
		labels.stopLoss,
		labels.takeProfit,
		pricePrecision,
		updateMarkerPositions,
	]);

	return (
		<div className={cn("relative min-h-[520px] overflow-hidden bg-[#141414]", className)}>
			<div className="left-6 top-5 gap-3 pointer-events-none absolute z-20 flex items-baseline">
				<span className="text-xl font-semibold tracking-normal text-white">{symbol}</span>
				<span className="text-lg font-semibold text-white/55">{timeframe}</span>
			</div>

			<div ref={containerRef} className="h-full min-h-[520px] w-full" />

			<div className="inset-0 pointer-events-none absolute z-30">
				{markerPositions.map(({ left, signal, top }) => {
					const isActive = signal.id === activeSignal?.id;
					const isEntered = signal.entryStatus === "entered";

					return (
						<button
							key={signal.id}
							type="button"
							onClick={() => onSelectSignal(signal)}
							className={cn(
								"gap-1.5 py-0.5 pl-0.5 pr-1.5 font-semibold text-white shadow-lg pointer-events-auto absolute isolate flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full border bg-[#141414]/95 text-[11px] transition-all",
								isEntered
									? "border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.36)]"
									: isActive
										? "border-emerald-400 shadow-[0_0_0_6px_rgba(34,229,141,0.14)]"
										: "border-white/15 hover:border-white/35",
							)}
							style={{ left, top } satisfies CSSProperties}
						>
							{isEntered && (
								<>
									<span className="-inset-1.5 border-emerald-400/45 animate-ping pointer-events-none absolute -z-10 rounded-full border opacity-70" />
									<span className="-inset-2 bg-emerald-500/20 blur-md animate-pulse pointer-events-none absolute -z-10 rounded-full" />
								</>
							)}
							<span
								className={cn(
									"flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full",
									!signal.avatarUrl &&
										(signal.direction === "long"
											? "bg-emerald-500"
											: "bg-rose-500"),
								)}
							>
								{signal.avatarUrl ? (
									<img
										alt={signal.sourceName}
										className="size-[22px] object-cover"
										src={signal.avatarUrl}
									/>
								) : (
									<span className="font-bold text-white text-[10px]">
										{signal.avatarLabel}
									</span>
								)}
							</span>
							<span className="max-w-24 truncate whitespace-nowrap">
								{signal.sourceName}
							</span>
							{isActive && (
								<span
									className={cn(
										"ml-0.5 rounded px-1.5 py-0.5 font-bold text-white text-[10px] whitespace-nowrap",
										signal.direction === "long"
											? "bg-emerald-500"
											: "bg-rose-500",
									)}
								>
									{labels.entry} {formatPrice(signal.entry, pricePrecision)}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
