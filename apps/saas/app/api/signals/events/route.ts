import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "@signals/lib/access";
import { subscribeToSignalEvents } from "@signals/lib/signal-events";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeEvent(event: string, data: unknown) {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
	const access = await getCurrentSignalsAccess();
	if (access !== SIGNALS_ACCESS.allowed) {
		return NextResponse.json(
			{
				error: "A paid membership is required to access signals.",
				ok: false,
			},
			{ status: access === SIGNALS_ACCESS.unauthenticated ? 401 : 403 },
		);
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(encodeEvent("ready", { ok: true })));

			const unsubscribe = subscribeToSignalEvents((signal) => {
				controller.enqueue(encoder.encode(encodeEvent("signal", signal)));
			});

			const keepAliveId = setInterval(() => {
				controller.enqueue(encoder.encode(": keepalive\n\n"));
			}, 25_000);

			request.signal.addEventListener("abort", () => {
				clearInterval(keepAliveId);
				unsubscribe();
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"Content-Type": "text/event-stream",
			"X-Accel-Buffering": "no",
		},
	});
}
