import { SignalSourceError } from "./signal-source-error";
import type { SignalWebhookBatchResponse, StoredSignal } from "./signal-types";
import {
	signalWebhookRequestSchema,
	type ParsedSignalWebhookRequest,
} from "./signal-webhook-schema";

export const MAX_SIGNAL_WEBHOOK_BATCH_SIZE = 100;

interface SignalWebhookBatchDependencies {
	save: (input: ParsedSignalWebhookRequest) => Promise<StoredSignal | null>;
	publish: (signal: StoredSignal) => void;
}

export async function processSignalWebhookBatch(
	items: unknown[],
	dependencies: SignalWebhookBatchDependencies,
): Promise<SignalWebhookBatchResponse> {
	const response: SignalWebhookBatchResponse = {
		ok: true,
		receivedAt: new Date().toISOString(),
		total: items.length,
		saved: 0,
		ignored: 0,
		invalid: 0,
		failed: 0,
		results: [],
	};
	for (const [index, item] of items.entries()) {
		const eventId =
			typeof item === "object" &&
			item !== null &&
			"eventId" in item &&
			typeof item.eventId === "string"
				? item.eventId
				: undefined;
		const parsed = signalWebhookRequestSchema.safeParse(item);
		if (!parsed.success) {
			response.invalid++;
			response.results.push({
				index,
				eventId,
				status: "invalid",
				error: "Invalid signal webhook payload.",
				issues: parsed.error.flatten(),
			});
			continue;
		}
		let signal: StoredSignal | null;
		try {
			signal = await dependencies.save(parsed.data);
		} catch (error) {
			if (error instanceof SignalSourceError) {
				response.invalid++;
				response.results.push({
					index,
					eventId,
					status: "invalid",
					code: error.code,
					error: error.message,
				});
				continue;
			}
			response.failed++;
			response.results.push({
				index,
				eventId,
				status: "failed",
				error: "Failed to store signal. Retry this item using the same eventId.",
			});
			continue;
		}
		if (!signal) {
			response.ignored++;
			response.results.push({ index, eventId, status: "ignored" });
			continue;
		}
		response.saved++;
		response.results.push({ index, eventId: signal.eventId, status: "saved", signal });
		try {
			dependencies.publish(signal);
		} catch {
			// A notification failure must not report an already persisted signal as a failed write.
		}
	}
	response.ok = response.invalid === 0 && response.failed === 0;
	return response;
}
