import { publishSignalEvent } from "@signals/lib/signal-events";
import { signalWebhookRequestSchema } from "@signals/lib/signal-webhook-schema";
import { upsertStoredSignal } from "@signals/lib/signal-store";
import type {
	SignalWebhookErrorResponse,
	SignalWebhookSuccessResponse,
} from "@signals/lib/signal-types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isWebhookAuthorized(request: Request) {
	const secret = process.env.SIGNAL_WEBHOOK_SECRET;

	if (!secret) {
		return true;
	}

	return request.headers.get("x-signal-webhook-secret") === secret;
}

export async function POST(request: Request) {
	if (!isWebhookAuthorized(request)) {
		const response: SignalWebhookErrorResponse = {
			error: "Invalid signal webhook secret.",
			ok: false,
		};

		return NextResponse.json(response, { status: 401 });
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		const response: SignalWebhookErrorResponse = {
			error: "Request body must be valid JSON.",
			ok: false,
		};

		return NextResponse.json(response, { status: 400 });
	}

	const parsed = signalWebhookRequestSchema.safeParse(body);

	if (!parsed.success) {
		const response: SignalWebhookErrorResponse = {
			error: "Invalid signal webhook payload.",
			issues: parsed.error.flatten(),
			ok: false,
		};

		return NextResponse.json(response, { status: 422 });
	}

	const signal = await upsertStoredSignal(parsed.data);
	publishSignalEvent(signal);

	const response: SignalWebhookSuccessResponse = {
		ok: true,
		receivedAt: new Date().toISOString(),
		signal,
	};

	return NextResponse.json(response, { status: 201 });
}
