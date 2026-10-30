import { getMarketKlines } from "@signals/lib/market-klines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public exchange candles contain no member signal positions or trade levels.
export const GET = getMarketKlines;
