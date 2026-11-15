import { logger } from "@repo/logs";
import { publishSignalEvent } from "@signals/lib/signal-events";
import { SignalSourceError } from "@signals/lib/signal-source-error";
import { upsertStoredSignal } from "@signals/lib/signal-store";
import type { SignalWebhookBatchItemResult } from "@signals/lib/signal-types";
import { beginWebhookAudit, finishWebhookAudit } from "@signals/lib/signal-webhook-audit";
import {
	MAX_SIGNAL_WEBHOOK_BATCH_SIZE,
	processSignalWebhookBatch,
} from "@signals/lib/signal-webhook-batch";
import { signalWebhookRequestSchema } from "@signals/lib/signal-webhook-schema";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isWebhookAuthorized(request: Request) {
	const secret = process.env.SIGNAL_WEBHOOK_SECRET;
	return !secret || request.headers.get("x-signal-webhook-secret") === secret;
}

async function rejectedResponse(error: string, status: number, startedAt: number) {
	try {
		const audit = await beginWebhookAudit("unknown", [], startedAt);
		const logStatus = await finishWebhookAudit(audit, status, [], error);
		return NextResponse.json({ ok: false, error, logId: audit.id, logStatus }, { status });
	} catch {
		logger.error("Failed to record rejected signal webhook call");
		return NextResponse.json({ ok: false, error, logStatus: "unavailable" }, { status });
	}
}

export async function POST(request: Request) {
	const startedAt = Date.now();
	if (!isWebhookAuthorized(request))
		return rejectedResponse("Invalid signal webhook secret.", 401, startedAt);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return rejectedResponse("Request body must be valid JSON.", 400, startedAt);
	}

	const isBatch =
		Array.isArray(body) || (typeof body === "object" && body !== null && "signals" in body);
	const batchItems = Array.isArray(body)
		? body
		: typeof body === "object" && body !== null && "signals" in body
			? body.signals
			: undefined;
	if (
		isBatch &&
		(!Array.isArray(batchItems) ||
			batchItems.length < 1 ||
			batchItems.length > MAX_SIGNAL_WEBHOOK_BATCH_SIZE)
	) {
		return rejectedResponse(
			`Batch must contain 1 to ${MAX_SIGNAL_WEBHOOK_BATCH_SIZE} signals.`,
			422,
			startedAt,
		);
	}
	let audit: Awaited<ReturnType<typeof beginWebhookAudit>>;
	try {
		audit = await beginWebhookAudit(
			isBatch ? "batch" : "single",
			isBatch ? (batchItems as unknown[]) : [body],
			startedAt,
		);
	} catch {
		logger.error("Failed to start signal webhook audit; no signals processed");
		return NextResponse.json(
			{
				ok: false,
				error: "Webhook logging is unavailable. No signals were processed. Retry later.",
				logStatus: "unavailable",
			},
			{ status: 503 },
		);
	}

	async function respond(
		response: object,
		status: number,
		results: SignalWebhookBatchItemResult[],
		error?: string,
	) {
		const logStatus = await finishWebhookAudit(audit, status, results, error);
		return NextResponse.json({ ...response, logId: audit.id, logStatus }, { status });
	}
	if (isBatch) {
		const response = await processSignalWebhookBatch(batchItems as unknown[], {
			save: upsertStoredSignal,
			publish: publishSignalEvent,
		});
		return respond(response, response.ok ? 200 : 207, response.results);
	}
	const parsed = signalWebhookRequestSchema.safeParse(body);
	if (!parsed.success) {
		const error = "Invalid signal webhook payload.";
		const issues = parsed.error.flatten();
		return respond(
			{ ok: false, error, issues },
			422,
			[{ index: 0, status: "invalid", error, issues }],
			error,
		);
	}
	let signal;
	try {
		signal = await upsertStoredSignal(parsed.data);
	} catch (cause) {
		if (cause instanceof SignalSourceError) {
			return respond(
				{ ok: false, error: cause.message, code: cause.code },
				422,
				[
					{
						index: 0,
						eventId: parsed.data.eventId,
						status: "invalid",
						code: cause.code,
						error: cause.message,
					},
				],
				cause.message,
			);
		}
		const error = "Failed to store signal. Retry this item using the same eventId.";
		return respond(
			{ ok: false, error },
			500,
			[{ index: 0, eventId: parsed.data.eventId, status: "failed", error }],
			error,
		);
	}
	const receivedAt = new Date().toISOString();
	if (!signal)
		return respond({ ok: true, ignored: true, receivedAt }, 202, [
			{ index: 0, eventId: parsed.data.eventId, status: "ignored" },
		]);
	try {
		publishSignalEvent(signal);
	} catch {
		logger.warn("Signal saved but live notification failed", { signalId: signal.id });
	}
	return respond({ ok: true, receivedAt, signal }, 201, [
		{ index: 0, eventId: signal.eventId, status: "saved", signal },
	]);
}
