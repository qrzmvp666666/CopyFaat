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
	focusedSignalId: string | null;
	labels: PriceLineLabels;
	locale: string;
	onSelectSignal: (signal: SignalChartSignal) => void;
	pricePrecision: number;
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
	takeProfit?: number;
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
const MARKER_STACK_GAP = 72;
const DESKTOP_CHART_INTERACTION_QUERY = "(min-width: 1280px)";
const DEFAULT_VISIBLE_CANDLE_COUNT = 72;
const DEFAULT_RIGHT_OFFSET = 6;

function getStackOffset(index: number) {
	if (index === 0) {
		return 0;
	}

	const direction = index % 2 === 1 ? 1 : -1;
	const distance = Math.ceil(index / 2) * MARKER_STACK_GAP;

	return direction * distance;
}

function hasMarkerPositionsChanged(previous: MarkerPosition[], next: MarkerPosition[]) {
	if (previous.length !== next.length) {
		return true;
	}

	return previous.some((position, index) => {
		const nextPosition = next[index];

		return (
			!nextPosition ||
			position.signal.id !== nextPosition.signal.id ||
			position.left !== nextPosition.left ||
			position.top !== nextPosition.top
		);
	});
}

function isMarkerInsideChartViewport(
	position: MarkerPosition | undefined,
	container: HTMLDivElement | null,
) {
	if (!position || !container) {
		return false;
	}

	const { height, width } = container.getBoundingClientRect();
	const edgePadding = 16;

	return (
		position.left >= edgePadding &&
		position.left <= width - edgePadding &&
		position.top >= edgePadding &&
		position.top <= height - edgePadding
	);
}

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

function getMinMove(pricePrecision: number) {
	return 10 ** -pricePrecision;
}

function getRiskPrice(signal: SignalChartSignal) {
	return signal.stopLoss;
}

function getChartDataRangeKey(chartData: CandlestickData<UTCTimestamp>[]) {
	const firstCandle = chartData[0];
	const lastCandle = chartData.at(-1);

	return `${chartData.length}:${String(firstCandle?.time ?? "")}:${String(lastCandle?.time ?? "")}`;
}

function isPositiveFiniteNumber(value: number | undefined): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getSignalPriceRange(activeSignal: SignalChartSignal | null) {
	const prices = activeSignal
		? [activeSignal.entry, activeSignal.takeProfit, activeSignal.stopLoss]
		: [];
	const validPrices = prices.filter(isPositiveFiniteNumber);

	if (!validPrices.length) {
		return null;
	}

	return {
		maxValue: Math.max(...validPrices),
		minValue: Math.min(...validPrices),
	};
}

function getChartInteractionOptions(isDesktopLayout: boolean) {
	return {
		handleScale: {
			axisDoubleClickReset: {
				price: true,
				time: true,
			},
			axisPressedMouseMove: {
				price: true,
				time: true,
			},
			mouseWheel: isDesktopLayout,
			pinch: true,
		},
		handleScroll: {
			horzTouchDrag: isDesktopLayout,
			mouseWheel: isDesktopLayout,
			pressedMouseMove: true,
			vertTouchDrag: false,
		},
	};
}

export function TradingViewSignalChart({
	activeSignal,
	candles,
	className,
	formatPrice,
	focusedSignalId,
	labels,
	locale,
	onSelectSignal,
	pricePrecision,
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
	const latestChartDataRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
	const latestMarkerPositionsRef = useRef<MarkerPosition[]>([]);
	const latestActiveSignalRef = useRef(activeSignal);
	const latestFormatPriceRef = useRef(formatPrice);
	const latestPricePrecisionRef = useRef(pricePrecision);
	const latestFocusedSignalKeyRef = useRef<string | null>(null);
	const latestViewKeyRef = useRef<string | null>(null);
	const markerRetryCountRef = useRef(0);
	const markerRetryTimeoutRef = useRef<number | null>(null);
	const [markerPositions, setMarkerPositions] = useState<MarkerPosition[]>([]);
	const minMove = getMinMove(pricePrecision);

	const autoscaleInfoProvider = useCallback<AutoscaleInfoProvider>(
		(original) => {
			const base = original();
			const signalRange = getSignalPriceRange(latestActiveSignalRef.current);

			if (!base?.priceRange || !signalRange) {
				return base;
			}

			const minValue = Math.min(base.priceRange.minValue, signalRange.minValue);
			const maxValue = Math.max(base.priceRange.maxValue, signalRange.maxValue);
			const padding = Math.max((maxValue - minValue) * 0.08, minMove * 6);

			return {
				...base,
				priceRange: {
					maxValue: maxValue + padding,
					minValue: Math.max(0, minValue - padding),
				},
			};
		},
		[minMove],
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

	latestActiveSignalRef.current = activeSignal;
	latestFormatPriceRef.current = formatPrice;
	latestPricePrecisionRef.current = pricePrecision;

	const updateMarkerPositions = useCallback(() => {
		const chart = chartRef.current;
		const series = seriesRef.current;

		if (!chart || !series) {
			return;
		}

		const stackCounts = new Map<string, number>();
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

			const roundedLeft = Math.round(left);
			const roundedTop = Math.round(top);
			const stackKey = `${roundedLeft}:${roundedTop}`;
			const stackIndex = stackCounts.get(stackKey) ?? 0;
			stackCounts.set(stackKey, stackIndex + 1);

			return [
				{
					left: roundedLeft + getStackOffset(stackIndex),
					signal,
					top: roundedTop,
				},
			];
		});

		if (nextPositions.length === 0 && latestSignalsRef.current.length > 0) {
			if (markerRetryCountRef.current < 12 && markerRetryTimeoutRef.current === null) {
				markerRetryCountRef.current += 1;
				markerRetryTimeoutRef.current = window.setTimeout(() => {
					markerRetryTimeoutRef.current = null;
					updateMarkerPositions();
				}, 120);
			}
			return;
		}

		markerRetryCountRef.current = 0;

		if (hasMarkerPositionsChanged(latestMarkerPositionsRef.current, nextPositions)) {
			latestMarkerPositionsRef.current = nextPositions;
			setMarkerPositions(nextPositions);
		}
	}, []);

	const scheduleMarkerPositionUpdate = useCallback(() => {
		window.requestAnimationFrame(() => {
			updateMarkerPositions();
			window.requestAnimationFrame(updateMarkerPositions);
		});

		window.setTimeout(updateMarkerPositions, 80);
	}, [updateMarkerPositions]);

	useEffect(() => {
		latestSignalsRef.current = signals;
		latestCandlesRef.current = candles;
		markerRetryCountRef.current = 0;
		scheduleMarkerPositionUpdate();
	}, [candles, signals, scheduleMarkerPositionUpdate]);

	useEffect(() => {
		const container = containerRef.current;

		if (!container) {
			return;
		}

		const interactionMediaQuery = window.matchMedia(DESKTOP_CHART_INTERACTION_QUERY);
		const chart = createChart(container, {
			height: Math.max(520, Math.round(container.getBoundingClientRect().height)),
			width: Math.max(1, Math.round(container.getBoundingClientRect().width)),
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
			...getChartInteractionOptions(interactionMediaQuery.matches),
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
				priceFormatter: (price: number) =>
					latestFormatPriceRef.current(price, latestPricePrecisionRef.current),
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
				rightOffset: DEFAULT_RIGHT_OFFSET,
				secondsVisible: false,
				timeVisible: true,
			},
		});

		const series = chart.addSeries(CandlestickSeries, {
			autoscaleInfoProvider,
			borderVisible: false,
			downColor: DOWN_COLOR,
			priceFormat: {
				minMove,
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
		latestChartDataRef.current = [];
		latestViewKeyRef.current = null;
		latestFocusedSignalKeyRef.current = null;

		const resizeObserver = new ResizeObserver(() => {
			const { height, width } = container.getBoundingClientRect();

			if (width > 0 && height > 0) {
				chart.resize(Math.round(width), Math.round(height));
			}

			scheduleMarkerPositionUpdate();
		});
		resizeObserver.observe(container);

		const handleRangeChange = () => scheduleMarkerPositionUpdate();
		chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

		const handleInteractionMediaQueryChange = (event: MediaQueryListEvent) => {
			chart.applyOptions(getChartInteractionOptions(event.matches));
		};
		interactionMediaQuery.addEventListener("change", handleInteractionMediaQueryChange);

		return () => {
			interactionMediaQuery.removeEventListener("change", handleInteractionMediaQueryChange);
			chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
			resizeObserver.disconnect();
			chart.remove();
			chartRef.current = null;
			seriesRef.current = null;
			priceLinesRef.current = [];
		};
	}, [autoscaleInfoProvider, locale, minMove, pricePrecision, scheduleMarkerPositionUpdate]);

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
		});
		series.applyOptions({
			autoscaleInfoProvider,
			priceFormat: {
				minMove,
				precision: pricePrecision,
				type: "price",
			},
		});
		const previousData = latestChartDataRef.current;
		const viewKey = `${symbol}:${timeframe}`;
		const previousRangeKey = getChartDataRangeKey(previousData);
		const nextRangeKey = getChartDataRangeKey(chartData);
		const previousFirstCandle = previousData[0];
		const previousLastCandle = previousData.at(-1);
		const nextFirstCandle = chartData[0];
		const nextLastCandle = chartData.at(-1);
		const shouldResetView =
			latestViewKeyRef.current !== viewKey ||
			previousData.length === 0 ||
			previousFirstCandle?.time !== nextFirstCandle?.time;

		if (
			!shouldResetView &&
			previousData.length === chartData.length &&
			previousLastCandle &&
			nextLastCandle &&
			previousLastCandle.time === nextLastCandle.time
		) {
			series.update(nextLastCandle);
		} else {
			series.setData(chartData);
		}

		latestChartDataRef.current = chartData;
		latestViewKeyRef.current = viewKey;

		if (shouldResetView) {
			chart.applyOptions({
				timeScale: {
					barSpacing: 7,
					rightOffset: DEFAULT_RIGHT_OFFSET,
				},
			});
			const from = Math.max(0, chartData.length - DEFAULT_VISIBLE_CANDLE_COUNT);
			chart.timeScale().setVisibleLogicalRange({
				from,
				to: chartData.length + DEFAULT_RIGHT_OFFSET,
			});
		}

		if (previousRangeKey !== nextRangeKey) {
			latestFocusedSignalKeyRef.current = null;
		}

		scheduleMarkerPositionUpdate();
	}, [
		autoscaleInfoProvider,
		chartData,
		formatPrice,
		locale,
		minMove,
		pricePrecision,
		symbol,
		timeframe,
		scheduleMarkerPositionUpdate,
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
			const priceLines = [
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

			if (activeSignal.takeProfit !== undefined) {
				priceLines.splice(
					1,
					0,
					series.createPriceLine({
						axisLabelColor: PROFIT_COLOR,
						axisLabelTextColor: "#111111",
						axisLabelVisible: true,
						color: PROFIT_COLOR,
						lineStyle: LineStyle.Dotted,
						lineVisible: true,
						lineWidth: 1,
						price: activeSignal.takeProfit,
						title: `${labels.takeProfit} ${formatPrice(activeSignal.takeProfit, pricePrecision)}`,
					}),
				);
			}

			priceLinesRef.current = priceLines;

			const focusedSignalKey = `${symbol}:${timeframe}:${getChartDataRangeKey(chartData)}:${activeSignal.id}`;

			if (
				focusedSignalId === activeSignal.id &&
				latestFocusedSignalKeyRef.current !== focusedSignalKey
			) {
				const activeMarkerPosition = latestMarkerPositionsRef.current.find(
					(position) => position.signal.id === activeSignal.id,
				);
				const isActiveMarkerVisible = isMarkerInsideChartViewport(
					activeMarkerPosition,
					containerRef.current,
				);

				if (!isActiveMarkerVisible) {
					const index = getSignalCandleIndex(activeSignal, candles.length);
					const activeCandle = getNearestSignalCandle(activeSignal, candles);
					const nearestIndex = activeCandle ? candles.indexOf(activeCandle) : index;
					chart.timeScale().setVisibleLogicalRange({
						from: Math.max(0, nearestIndex - 72),
						to: Math.min(candles.length + 10, nearestIndex + 26),
					});
				}

				latestFocusedSignalKeyRef.current = focusedSignalKey;
			}
		} else {
			latestFocusedSignalKeyRef.current = null;
		}

		scheduleMarkerPositionUpdate();
	}, [
		activeSignal,
		candles,
		chartData,
		focusedSignalId,
		formatPrice,
		labels.entry,
		labels.stopLoss,
		labels.takeProfit,
		pricePrecision,
		scheduleMarkerPositionUpdate,
		symbol,
		timeframe,
	]);

	useEffect(() => {
		return () => {
			if (markerRetryTimeoutRef.current !== null) {
				window.clearTimeout(markerRetryTimeoutRef.current);
			}
		};
	}, []);

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
								"gap-1.5 py-0.5 pl-0.5 pr-1.5 font-semibold text-white shadow-lg pointer-events-auto absolute isolate flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full border bg-[#141414]/95 text-[11px] transition-colors",
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
									<span className="-inset-1.5 border-emerald-400/35 pointer-events-none absolute -z-10 rounded-full border" />
									<span className="-inset-2 bg-emerald-500/18 blur-md pointer-events-none absolute -z-10 rounded-full" />
								</>
							)}
							<span
								className={cn(
									"flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full",
								)}
							>
								<img
									alt={signal.sourceName}
									className="size-[22px] object-cover"
									src={signal.avatarUrl}
								/>
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
