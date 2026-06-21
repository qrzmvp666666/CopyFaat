import type { SignalKline, SignalKlinesResponse } from "@signals/lib/signal-types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines";
const SUPPORTED_INTERVALS = ["15m", "1h", "4h", "1d"] as const;

const searchParamsSchema = z.object({
	interval: z.enum(SUPPORTED_INTERVALS).default("1h"),
	limit: z.coerce.number().int().min(20).max(500).default(180),
	symbol: z
		.string()
		.trim()
		.min(3)
		.max(24)
		.transform((symbol) => symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()),
});

type BinanceKline = [
	number,
	string,
	string,
	string,
	string,
	string,
	number,
	string,
	number,
	string,
	string,
	string,
];

function parseKline(value: unknown): SignalKline | null {
	if (!Array.isArray(value) || value.length < 5 || typeof value[0] !== "number") {
		return null;
	}

	const [, open, high, low, close] = value as BinanceKline;
	const kline = {
		close: Number(close),
		high: Number(high),
		low: Number(low),
		open: Number(open),
		time: Math.floor(value[0] / 1000),
	};

	if (
		!Number.isFinite(kline.close) ||
		!Number.isFinite(kline.high) ||
		!Number.isFinite(kline.low) ||
		!Number.isFinite(kline.open)
	) {
		return null;
	}

	return kline;
}

export async function GET(request: Request) {
	const parsed = searchParamsSchema.safeParse(
		Object.fromEntries(new URL(request.url).searchParams),
	);

	if (!parsed.success) {
		return NextResponse.json(
			{
				error: "Invalid kline query.",
				issues: parsed.error.flatten(),
				ok: false,
			},
			{ status: 422 },
		);
	}

	const { interval, limit, symbol } = parsed.data;
	const url = new URL(BINANCE_KLINES_URL);
	url.searchParams.set("symbol", symbol);
	url.searchParams.set("interval", interval);
	url.searchParams.set("limit", String(limit));

	const response = await fetch(url, {
		headers: {
			accept: "application/json",
		},
		next: {
			revalidate: 20,
		},
	});

	if (!response.ok) {
		return NextResponse.json(
			{
				error: "Failed to load Binance klines.",
				ok: false,
				status: response.status,
			},
			{ status: 502 },
		);
	}

	const data = (await response.json()) as unknown;

	if (!Array.isArray(data)) {
		return NextResponse.json(
			{
				error: "Unexpected Binance kline response.",
				ok: false,
			},
			{ status: 502 },
		);
	}

	const klines = data.map(parseKline).filter((kline): kline is SignalKline => Boolean(kline));
	const result: SignalKlinesResponse = {
		klines,
		source: "binance",
		symbol,
		timeframe: interval,
	};

	return NextResponse.json(result, {
		headers: {
			"Cache-Control": "s-maxage=20, stale-while-revalidate=60",
		},
	});
}
