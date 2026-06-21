import { listStoredSignals } from "@signals/lib/signal-store";
import type { SignalsListResponse } from "@signals/lib/signal-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const signals = await listStoredSignals();
	const response: SignalsListResponse = { signals };

	return NextResponse.json(response, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
