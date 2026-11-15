import { createSignalsPreview } from "@signals/lib/signal-preview";
import {
	listActiveTradingSymbols,
	listSignalPreviewTraders,
	listStoredSignals,
} from "@signals/lib/signal-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	try {
		const [{ signals }, traders, tradingSymbols] = await Promise.all([
			listStoredSignals({ limit: 200 }),
			listSignalPreviewTraders(),
			listActiveTradingSymbols(),
		]);
		return NextResponse.json(
			{ ...createSignalsPreview(signals, traders), tradingSymbols },
			{
				headers: { "Cache-Control": "public, max-age=30" },
			},
		);
	} catch {
		return NextResponse.json({ error: "Preview is temporarily unavailable." }, { status: 503 });
	}
}
