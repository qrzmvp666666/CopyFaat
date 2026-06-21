import { subscribeToSignalEvents } from "@signals/lib/signal-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function encodeEvent(event: string, data: unknown) {
	return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
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
