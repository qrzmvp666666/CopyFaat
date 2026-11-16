import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "@signals/lib/access";
import { listActiveSignalTraders } from "@signals/lib/signal-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const access = await getCurrentSignalsAccess();
	if (access !== SIGNALS_ACCESS.allowed) {
		return NextResponse.json(
			{ error: "A paid membership is required to access signals.", ok: false },
			{ status: access === SIGNALS_ACCESS.unauthenticated ? 401 : 403 },
		);
	}

	const sources = await listActiveSignalTraders();
	return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } });
}
