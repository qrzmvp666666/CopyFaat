import { ORPCError } from "@orpc/client";
import {
	countRedeemCodeBatches,
	countRedeemCodes,
	createRedeemCodeBatch,
	getRedeemCodeBatchById,
	getRedeemCodeAdminStats,
	getRedeemCodeBatches,
	getRedeemCodes,
	type RedeemCodeSeed,
} from "@repo/database";
import { config as paymentsConfig } from "@repo/payments/config";
import { z } from "zod";

import { adminProcedure } from "../../../orpc/procedures";
import { createRedeemCode, hashRedeemCode } from "../../payments/lib/redeem-code";

const createRedeemCodeBatchInputSchema = z.object({
	name: z.string().trim().min(1).max(120),
	planId: z.string().trim().min(1),
	durationDays: z.number().int().min(1).max(3650),
	quantity: z.number().int().min(1).max(1000),
	redeemBefore: z.string().datetime().optional().nullable(),
	note: z.string().trim().max(1000).optional().nullable(),
});

const redeemCodeFiltersInputSchema = z.object({
	query: z.string().optional(),
	status: z.enum(["all", "available", "redeemed", "expired"]).default("all"),
	planId: z.string().optional(),
	batchId: z.string().optional(),
	redeemedFrom: z.string().datetime().optional().nullable(),
	redeemedTo: z.string().datetime().optional().nullable(),
});

const listRedeemCodesInputSchema = redeemCodeFiltersInputSchema.extend({
	limit: z.number().min(1).max(100).default(10),
	offset: z.number().min(0).default(0),
});

export const createBatch = adminProcedure
	.route({
		method: "POST",
		path: "/admin/redeem-codes/batches",
		tags: ["Administration"],
		summary: "Create redeem codes",
	})
	.input(createRedeemCodeBatchInputSchema)
	.handler(async ({ input, context: { user } }) => {
		if (!(input.planId in paymentsConfig.plans) || input.planId === "free") {
			throw new ORPCError("BAD_REQUEST");
		}

		const codes: RedeemCodeSeed[] = [];
		const existingCodes = new Set<string>();

		while (codes.length < input.quantity) {
			const code = createRedeemCode();
			if (existingCodes.has(code)) {
				continue;
			}
			existingCodes.add(code);
			codes.push({
				code,
				codeHash: hashRedeemCode(code),
				codePrefix: code.slice(0, 8),
			});
		}

		const batch = await createRedeemCodeBatch({
			...input,
			note: input.note || null,
			redeemBefore: input.redeemBefore ? new Date(input.redeemBefore) : null,
			createdById: user.id,
			codes,
		});

		return {
			batch,
			codes: batch.codes.map((redeemCode) => redeemCode.code),
			csv: buildRedeemCodeCsv(
				batch.codes.map((redeemCode) => ({
					code: redeemCode.code,
					status: redeemCode.status,
					redeemedByEmail: "",
					redeemedAt: null,
					startsAt: null,
					expiresAt: null,
				})),
			),
		};
	});

export const listBatches = adminProcedure
	.route({
		method: "GET",
		path: "/admin/redeem-codes/batches",
		tags: ["Administration"],
		summary: "List redeem code batches",
	})
	.input(
		z.object({
			query: z.string().optional(),
			limit: z.number().min(1).max(100).default(10),
			offset: z.number().min(0).default(0),
		}),
	)
	.handler(async ({ input: { query, limit, offset } }) => {
		const [batches, total] = await Promise.all([
			getRedeemCodeBatches({ query, limit, offset }),
			countRedeemCodeBatches(query),
		]);

		return { batches, total };
	});

export const listCodes = adminProcedure
	.route({
		method: "GET",
		path: "/admin/redeem-codes",
		tags: ["Administration"],
		summary: "List redeem codes",
	})
	.input(listRedeemCodesInputSchema)
	.handler(async ({ input }) => {
		const now = new Date();
		const status = input.status === "all" ? undefined : input.status;
		const [codes, total] = await Promise.all([
			getRedeemCodes({
				...input,
				status,
				redeemedFrom: input.redeemedFrom ? new Date(input.redeemedFrom) : undefined,
				redeemedTo: input.redeemedTo ? new Date(input.redeemedTo) : undefined,
				now,
			}),
			countRedeemCodes({
				query: input.query,
				status,
				planId: input.planId,
				batchId: input.batchId,
				redeemedFrom: input.redeemedFrom ? new Date(input.redeemedFrom) : undefined,
				redeemedTo: input.redeemedTo ? new Date(input.redeemedTo) : undefined,
				now,
			}),
		]);

		return {
			codes: codes.map((code) => ({
				...code,
				displayStatus: getDisplayStatus(code.status, code.batch.redeemBefore, now),
			})),
			total,
		};
	});

export const exportCodes = adminProcedure
	.route({
		method: "GET",
		path: "/admin/redeem-codes/export",
		tags: ["Administration"],
		summary: "Export redeem codes",
	})
	.input(redeemCodeFiltersInputSchema)
	.handler(async ({ input }) => {
		const now = new Date();
		const status = input.status === "all" ? undefined : input.status;
		const codes = await getRedeemCodes({
			...input,
			status,
			redeemedFrom: input.redeemedFrom ? new Date(input.redeemedFrom) : undefined,
			redeemedTo: input.redeemedTo ? new Date(input.redeemedTo) : undefined,
			limit: 10000,
			offset: 0,
			now,
		});

		return {
			fileName: "redeem-codes.csv",
			csv: buildRedeemCodeCsv(
				codes.map((redeemCode) => ({
					code: redeemCode.code,
					status: getDisplayStatus(redeemCode.status, redeemCode.batch.redeemBefore, now),
					redeemedByEmail: redeemCode.redeemedBy?.email ?? "",
					redeemedAt: redeemCode.redeemedAt,
					startsAt: redeemCode.entitlementGrant?.startsAt ?? null,
					expiresAt: redeemCode.entitlementGrant?.expiresAt ?? null,
				})),
			),
		};
	});

export const stats = adminProcedure
	.route({
		method: "GET",
		path: "/admin/redeem-codes/stats",
		tags: ["Administration"],
		summary: "Get redeem code stats",
	})
	.handler(async () => {
		return getRedeemCodeAdminStats();
	});

export const exportBatch = adminProcedure
	.route({
		method: "GET",
		path: "/admin/redeem-codes/batches/{id}/export",
		tags: ["Administration"],
		summary: "Export redeem codes",
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input: { id } }) => {
		const batch = await getRedeemCodeBatchById(id);

		if (!batch) {
			throw new ORPCError("NOT_FOUND");
		}

		return {
			fileName: `${slugifyFileName(batch.name)}-${batch.id}.csv`,
			csv: buildRedeemCodeCsv(
				batch.codes.map((redeemCode) => ({
					code: redeemCode.code,
					status: redeemCode.status,
					redeemedByEmail: redeemCode.redeemedBy?.email ?? "",
					redeemedAt: redeemCode.redeemedAt,
					startsAt: redeemCode.entitlementGrant?.startsAt ?? null,
					expiresAt: redeemCode.entitlementGrant?.expiresAt ?? null,
				})),
			),
		};
	});

interface RedeemCodeCsvRow {
	code: string;
	status: string;
	redeemedByEmail: string;
	redeemedAt: Date | null;
	startsAt: Date | null;
	expiresAt: Date | null;
}

function buildRedeemCodeCsv(rows: RedeemCodeCsvRow[]) {
	const header = ["code", "status", "redeemedByEmail", "redeemedAt", "startsAt", "expiresAt"];
	const body = rows.map((row) =>
		[
			row.code,
			row.status,
			row.redeemedByEmail,
			formatDate(row.redeemedAt),
			formatDate(row.startsAt),
			formatDate(row.expiresAt),
		]
			.map(escapeCsvCell)
			.join(","),
	);

	return [header.join(","), ...body].join("\n");
}

function escapeCsvCell(value: string) {
	if (!/[",\n]/.test(value)) {
		return value;
	}

	return `"${value.replaceAll('"', '""')}"`;
}

function formatDate(value: Date | null) {
	return value?.toISOString() ?? "";
}

function getDisplayStatus(status: string, redeemBefore: Date | null, now: Date) {
	if (status === "redeemed") {
		return "redeemed";
	}

	if (redeemBefore && redeemBefore.getTime() < now.getTime()) {
		return "expired";
	}

	return "available";
}

function slugifyFileName(value: string) {
	return (
		value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "redeem-codes"
	);
}
