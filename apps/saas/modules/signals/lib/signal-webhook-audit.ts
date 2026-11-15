import { randomUUID } from "node:crypto";

import {
	createSignalWebhookLog,
	completeSignalWebhookLog,
	type SignalWebhookLogItem,
} from "@repo/database";
import { logger } from "@repo/logs";

import type { SignalWebhookBatchItemResult } from "./signal-types";

const INPUT_FIELDS = [
	"chartPositionPct",
	"eventId",
	"symbol",
	"direction",
	"entry",
	"stopLoss",
	"takeProfit",
	"entryStatus",
	"status",
	"submittedAt",
	"exchange",
	"timeframe",
	"note",
	"outcome",
] as const;

export function getWebhookAuditItems(items: unknown[]): SignalWebhookLogItem[] {
	return items.map((item, index) => {
		const input: SignalWebhookLogItem["input"] = {};
		if (typeof item === "object" && item !== null && !Array.isArray(item)) {
			const record = item as Record<string, unknown>;
			for (const key of INPUT_FIELDS) {
				const value = record[key];
				if (typeof value === "string")
					input[key] = value.slice(0, key === "note" ? 500 : 200);
				else if (typeof value === "number" && Number.isFinite(value)) input[key] = value;
				else if (typeof value === "boolean" || value === null) input[key] = value;
			}
			const source = record.source;
			if (typeof source === "string") input.sourceName = source.slice(0, 80);
			else if (typeof source === "object" && source !== null) {
				const value = source as Record<string, unknown>;
				if (typeof value.name === "string") input.sourceName = value.name.slice(0, 80);
				for (const field of ["serverName", "channelName", "categoryName"] as const) {
					if (typeof value[field] === "string") input[field] = value[field].slice(0, 160);
				}
				if (typeof value.platform === "string")
					input.platform = value.platform.slice(0, 80);
			}
		}
		return {
			index,
			eventId: typeof input.eventId === "string" ? input.eventId : undefined,
			status: "pending",
			input,
			errors: [],
		};
	});
}

export async function beginWebhookAudit(
	mode: "single" | "batch" | "unknown",
	values: unknown[],
	startedAt = Date.now(),
) {
	const id = randomUUID();
	const items = getWebhookAuditItems(values);
	await createSignalWebhookLog({ id, mode, total: items.length, items });
	return { id, items, startedAt };
}

export function getWebhookAuditErrors(issues: unknown): string[] {
	if (typeof issues !== "object" || issues === null) return [];
	const result: string[] = [];
	const value = issues as Record<string, unknown>;
	if (Array.isArray(value.formErrors))
		result.push(
			...value.formErrors.filter((error): error is string => typeof error === "string"),
		);
	if (typeof value.fieldErrors === "object" && value.fieldErrors !== null) {
		for (const [field, errors] of Object.entries(value.fieldErrors)) {
			if (Array.isArray(errors))
				for (const error of errors)
					if (typeof error === "string") result.push(`${field}: ${error}`);
		}
	}
	return result;
}

export async function finishWebhookAudit(
	audit: Awaited<ReturnType<typeof beginWebhookAudit>>,
	httpStatus: number,
	results: SignalWebhookBatchItemResult[],
	error?: string,
) {
	const items = audit.items.map((item) => {
		const result = results.find((value) => value.index === item.index);
		return result
			? {
					...item,
					eventId: item.eventId ?? result.eventId,
					signalId: result.signal?.id,
					status: result.status,
					code: result.code,
					errors: [
						...(result.error ? [result.error] : []),
						...getWebhookAuditErrors(result.issues),
					],
				}
			: item;
	});
	const saved = results.filter((item) => item.status === "saved").length;
	const ignored = results.filter((item) => item.status === "ignored").length;
	const invalid = results.filter((item) => item.status === "invalid").length;
	const failed = results.filter((item) => item.status === "failed").length;
	try {
		await completeSignalWebhookLog(audit.id, {
			status:
				httpStatus >= 400
					? httpStatus >= 500
						? "failed"
						: "rejected"
					: invalid || failed
						? "partial"
						: "success",
			httpStatus,
			total: items.length,
			saved,
			ignored,
			invalid,
			failed,
			durationMs: Date.now() - audit.startedAt,
			error,
			items,
		});
		return "recorded" as const;
	} catch {
		logger.error("Failed to finalize signal webhook log", { logId: audit.id });
		return "unavailable" as const;
	}
}
