import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
	return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function numberFromInput(value: unknown) {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value !== "string") {
		return value;
	}

	const normalized = value.trim().replace(/,/g, "");
	if (!normalized || normalized === "---") {
		return undefined;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : value;
}

function normalizeSymbol(value: string) {
	return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function normalizeEntryStatus(value: unknown) {
	if (value === "待入场") {
		return "pending";
	}

	if (value === "持仓中" || value === "已入场" || value === "已更新") {
		return "entered";
	}

	return value;
}

function normalizeStatus(value: unknown) {
	if (value === "已平仓" || value === "history") {
		return "history";
	}

	if (value === "待入场" || value === "持仓中" || value === "已入场" || value === "已更新") {
		return "active";
	}

	return value;
}

function normalizeSource(value: unknown) {
	if (typeof value === "string") {
		const name = value.trim();
		return name ? { id: name, name } : value;
	}

	return value;
}

function normalizeSubmittedAt(value: unknown) {
	if (typeof value !== "string") {
		return value;
	}

	const trimmed = value.trim();
	const match = trimmed.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
	if (!match) {
		return value;
	}

	const [, month, day, hour, minute] = match;
	return `${new Date().getFullYear()}-${month}-${day}T${hour}:${minute}:00+08:00`;
}

export const signalWebhookRequestSchema = z
	.object({
		chartPositionPct: z.preprocess(
			emptyStringToUndefined,
			z.preprocess(numberFromInput, z.number().min(0).max(100).optional()),
		),
		direction: z.enum(["long", "short"]),
		entry: z.preprocess(numberFromInput, z.number().positive()),
		entryStatus: z.preprocess(normalizeEntryStatus, z.enum(["pending", "entered"]).optional()),
		eventId: z.string().trim().min(1).max(160).optional(),
		exchange: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(40).optional()),
		note: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(500).optional()),
		outcome: z.string().trim().min(1).max(40).optional(),
		source: z.preprocess(
			normalizeSource,
			z.object({
				id: z.string().trim().min(1).max(80).optional(),
				name: z.string().trim().min(1).max(80),
				avatarUrl: z.url().optional(),
				bio: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(500).optional()),
				handle: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(120).optional()),
				platform: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(80).optional()),
			}),
		),
		status: z.preprocess(normalizeStatus, z.enum(["active", "history"]).optional()),
		stopLoss: z.preprocess(numberFromInput, z.number().positive()),
		submittedAt: z.preprocess(normalizeSubmittedAt, z.iso.datetime({ offset: true }).optional()),
		symbol: z
			.string()
			.trim()
			.min(3)
			.max(24)
			.transform(normalizeSymbol),
		takeProfit: z.preprocess(numberFromInput, z.number().positive()),
		timeframe: z.string().trim().min(1).max(12).optional(),
	})
	.refine((input) => input.takeProfit !== input.entry, {
		message: "takeProfit must be different from entry",
		path: ["takeProfit"],
	})
	.refine((input) => input.stopLoss !== input.entry, {
		message: "stopLoss must be different from entry",
		path: ["stopLoss"],
	})
	.refine(
		(input) =>
			input.direction === "long"
				? input.takeProfit > input.entry && input.stopLoss < input.entry
				: input.takeProfit < input.entry && input.stopLoss > input.entry,
		{
			message:
				"For long signals, takeProfit must be above entry and stopLoss below entry. For short signals, takeProfit must be below entry and stopLoss above entry.",
			path: ["direction"],
		},
	);

export type ParsedSignalWebhookRequest = z.infer<typeof signalWebhookRequestSchema>;
