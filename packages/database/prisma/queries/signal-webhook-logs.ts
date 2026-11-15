import { db } from "../client";
import type { Prisma } from "../generated/client";

export const SIGNAL_WEBHOOK_LOG_STATUSES = [
	"processing",
	"success",
	"partial",
	"rejected",
	"failed",
] as const;
export type SignalWebhookLogStatus = (typeof SIGNAL_WEBHOOK_LOG_STATUSES)[number];

export interface SignalWebhookLogItem {
	index: number;
	eventId?: string;
	signalId?: string;
	code?: string;
	status: "pending" | "saved" | "ignored" | "invalid" | "failed";
	input: Record<string, string | number | boolean | null>;
	errors: string[];
}

export interface CreateSignalWebhookLogInput {
	id: string;
	mode: "single" | "batch" | "unknown";
	total: number;
	items: SignalWebhookLogItem[];
}
export interface CompleteSignalWebhookLogInput {
	status: SignalWebhookLogStatus;
	httpStatus: number;
	total: number;
	saved: number;
	ignored: number;
	invalid: number;
	failed: number;
	durationMs: number;
	error?: string;
	items: SignalWebhookLogItem[];
}

export async function createSignalWebhookLog(input: CreateSignalWebhookLogInput) {
	return db.signalWebhookLog.create({
		data: {
			...input,
			searchText: getSearchText(input.items),
			items: input.items as unknown as Prisma.InputJsonValue,
		},
		select: { id: true },
	});
}

export async function completeSignalWebhookLog(id: string, input: CompleteSignalWebhookLogInput) {
	return db.signalWebhookLog.update({
		where: { id },
		data: {
			...input,
			completedAt: new Date(),
			searchText: getSearchText(input.items),
			items: input.items as unknown as Prisma.InputJsonValue,
		},
		select: { id: true },
	});
}

function getSearchText(items: SignalWebhookLogItem[]) {
	return items
		.map((item) =>
			[
				item.eventId,
				item.signalId,
				item.input.sourceName,
				item.input.symbol,
				item.input.serverName,
				item.input.channelName,
				item.input.categoryName,
				item.code,
			]
				.filter(Boolean)
				.join(" "),
		)
		.join(" ");
}

export async function listSignalWebhookLogs(input: {
	query?: string;
	status?: SignalWebhookLogStatus;
	limit: number;
	offset: number;
}) {
	const search: Prisma.SignalWebhookLogWhereInput = input.query
		? {
				OR: [
					{ id: { contains: input.query, mode: "insensitive" } },
					{ searchText: { contains: input.query, mode: "insensitive" } },
				],
			}
		: {};
	const where = { ...search, ...(input.status ? { status: input.status } : {}) };
	const [logs, total, groups] = await Promise.all([
		db.signalWebhookLog.findMany({
			where,
			take: input.limit,
			skip: input.offset,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: {
				id: true,
				mode: true,
				status: true,
				httpStatus: true,
				total: true,
				saved: true,
				ignored: true,
				invalid: true,
				failed: true,
				durationMs: true,
				error: true,
				createdAt: true,
				completedAt: true,
			},
		}),
		db.signalWebhookLog.count({ where }),
		db.signalWebhookLog.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
	]);
	return {
		logs,
		total,
		summary: {
			total: groups.reduce((sum, group) => sum + group._count._all, 0),
			success: groups.find((group) => group.status === "success")?._count._all ?? 0,
			attention: groups
				.filter((group) => ["partial", "rejected", "failed"].includes(group.status))
				.reduce((sum, group) => sum + group._count._all, 0),
			processing: groups.find((group) => group.status === "processing")?._count._all ?? 0,
		},
	};
}

export async function getSignalWebhookLog(id: string) {
	const log = await db.signalWebhookLog.findUnique({ where: { id } });
	return log ? { ...log, items: log.items as unknown as SignalWebhookLogItem[] } : null;
}
