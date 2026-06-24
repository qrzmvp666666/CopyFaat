import { db } from "../client";
import type { Prisma } from "../generated/client";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export interface RedeemCodeSeed {
	code: string;
	codeHash: string;
	codePrefix: string;
}

export interface CreateRedeemCodeBatchInput {
	name: string;
	planId: string;
	durationDays: number;
	quantity: number;
	redeemBefore?: Date | null;
	note?: string | null;
	createdById: string;
	codes: RedeemCodeSeed[];
}

export interface ListRedeemCodeBatchesInput {
	query?: string;
	limit: number;
	offset: number;
}

export interface ListRedeemCodesInput {
	query?: string;
	status?: string;
	planId?: string;
	batchId?: string;
	redeemedFrom?: Date;
	redeemedTo?: Date;
	limit: number;
	offset: number;
	now?: Date;
}

export async function createRedeemCodeBatch(input: CreateRedeemCodeBatchInput) {
	return db.redeemCodeBatch.create({
		data: {
			name: input.name,
			planId: input.planId,
			durationDays: input.durationDays,
			quantity: input.quantity,
			redeemBefore: input.redeemBefore,
			note: input.note,
			createdById: input.createdById,
			codes: {
				create: input.codes.map((code) => ({
					code: code.code,
					codeHash: code.codeHash,
					codePrefix: code.codePrefix,
				})),
			},
		},
		include: {
			codes: {
				orderBy: {
					createdAt: "asc",
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});
}

export async function getRedeemCodeBatches({ query, limit, offset }: ListRedeemCodeBatchesInput) {
	const where = getRedeemCodeBatchWhere(query);
	const batches = await db.redeemCodeBatch.findMany({
		where,
		take: limit,
		skip: offset,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			_count: {
				select: {
					codes: true,
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});

	const redeemedCounts = await Promise.all(
		batches.map((batch) =>
			db.redeemCode.count({
				where: {
					batchId: batch.id,
					status: "redeemed",
				},
			}),
		),
	);

	return batches.map((batch, index) => ({
		...batch,
		redeemedCount: redeemedCounts[index] ?? 0,
		totalCount: batch._count.codes,
	}));
}

export async function countRedeemCodeBatches(query?: string) {
	return db.redeemCodeBatch.count({
		where: getRedeemCodeBatchWhere(query),
	});
}

export async function getRedeemCodeAdminStats(now = new Date()) {
	const [total, redeemed, expired] = await Promise.all([
		db.redeemCode.count(),
		db.redeemCode.count({
			where: {
				status: "redeemed",
			},
		}),
		db.redeemCode.count({
			where: {
				status: "available",
				batch: {
					redeemBefore: {
						lt: now,
					},
				},
			},
		}),
	]);

	return {
		total,
		redeemed,
		available: Math.max(total - redeemed - expired, 0),
		expired,
	};
}

export async function getRedeemCodes({
	query,
	status,
	planId,
	batchId,
	redeemedFrom,
	redeemedTo,
	limit,
	offset,
	now = new Date(),
}: ListRedeemCodesInput) {
	const where = getRedeemCodeWhere({
		query,
		status,
		planId,
		batchId,
		redeemedFrom,
		redeemedTo,
		now,
	});

	return db.redeemCode.findMany({
		where,
		take: limit,
		skip: offset,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			batch: {
				select: {
					id: true,
					name: true,
					planId: true,
					durationDays: true,
					redeemBefore: true,
				},
			},
			redeemedBy: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
			entitlementGrant: {
				select: {
					startsAt: true,
					expiresAt: true,
				},
			},
		},
	});
}

export async function countRedeemCodes(input: Omit<ListRedeemCodesInput, "limit" | "offset">) {
	return db.redeemCode.count({
		where: getRedeemCodeWhere(input),
	});
}

export async function getRedeemCodeBatchById(id: string) {
	return db.redeemCodeBatch.findUnique({
		where: {
			id,
		},
		include: {
			codes: {
				orderBy: {
					createdAt: "asc",
				},
				include: {
					redeemedBy: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
					entitlementGrant: true,
				},
			},
			createdBy: {
				select: {
					id: true,
					name: true,
					email: true,
				},
			},
		},
	});
}

export async function getEntitlementGrantsByUserId(userId: string) {
	return db.entitlementGrant.findMany({
		where: {
			userId,
		},
		orderBy: {
			createdAt: "desc",
		},
		include: {
			redeemCode: {
				select: {
					id: true,
					codePrefix: true,
					status: true,
					redeemedAt: true,
					batch: {
						select: {
							id: true,
							name: true,
							planId: true,
							durationDays: true,
							redeemBefore: true,
						},
					},
				},
			},
		},
	});
}

export async function getUnexpiredEntitlementGrantsByUserId(userId: string, now = new Date()) {
	return db.entitlementGrant.findMany({
		where: {
			userId,
			expiresAt: {
				gt: now,
			},
		},
		orderBy: {
			expiresAt: "desc",
		},
	});
}

export async function redeemCodeForUser(input: { userId: string; codeHash: string; now?: Date }) {
	const now = input.now ?? new Date();

	return db.$transaction(async (tx) => {
		const redeemCode = await tx.redeemCode.findUnique({
			where: {
				codeHash: input.codeHash,
			},
			include: {
				batch: true,
				entitlementGrant: true,
			},
		});

		if (!redeemCode) {
			return {
				ok: false as const,
				reason: "not_found" as const,
			};
		}

		if (redeemCode.redeemedAt || redeemCode.status !== "available") {
			return {
				ok: false as const,
				reason: "already_redeemed" as const,
			};
		}

		if (
			redeemCode.batch.redeemBefore &&
			redeemCode.batch.redeemBefore.getTime() < now.getTime()
		) {
			return {
				ok: false as const,
				reason: "expired" as const,
			};
		}

		const updated = await tx.redeemCode.updateMany({
			where: {
				id: redeemCode.id,
				status: "available",
				redeemedAt: null,
			},
			data: {
				status: "redeemed",
				redeemedById: input.userId,
				redeemedAt: now,
			},
		});

		if (updated.count !== 1) {
			return {
				ok: false as const,
				reason: "already_redeemed" as const,
			};
		}

		const latestGrant = await tx.entitlementGrant.findFirst({
			where: {
				userId: input.userId,
				planId: redeemCode.batch.planId,
				expiresAt: {
					gt: now,
				},
			},
			orderBy: {
				expiresAt: "desc",
			},
		});

		const startsAt =
			latestGrant && latestGrant.expiresAt.getTime() > now.getTime()
				? latestGrant.expiresAt
				: now;
		const expiresAt = new Date(startsAt.getTime() + redeemCode.batch.durationDays * DAY_IN_MS);

		const entitlementGrant = await tx.entitlementGrant.create({
			data: {
				userId: input.userId,
				redeemCodeId: redeemCode.id,
				source: "redeem_code",
				planId: redeemCode.batch.planId,
				durationDays: redeemCode.batch.durationDays,
				startsAt,
				expiresAt,
			},
		});

		return {
			ok: true as const,
			redeemCode: {
				...redeemCode,
				status: "redeemed",
				redeemedById: input.userId,
				redeemedAt: now,
			},
			entitlementGrant,
		};
	});
}

function getRedeemCodeBatchWhere(query?: string) {
	const normalizedQuery = query?.trim();

	if (!normalizedQuery) {
		return undefined;
	}

	return {
		OR: [
			{
				name: {
					contains: normalizedQuery,
					mode: "insensitive" as const,
				},
			},
			{
				planId: {
					contains: normalizedQuery,
					mode: "insensitive" as const,
				},
			},
			{
				note: {
					contains: normalizedQuery,
					mode: "insensitive" as const,
				},
			},
		],
	};
}

function getRedeemCodeWhere({
	query,
	status,
	planId,
	batchId,
	redeemedFrom,
	redeemedTo,
	now = new Date(),
}: Omit<ListRedeemCodesInput, "limit" | "offset">) {
	const normalizedQuery = query?.trim();
	const where: Prisma.RedeemCodeWhereInput = {
		AND: [],
	};
	const andConditions = where.AND as Prisma.RedeemCodeWhereInput[];

	if (normalizedQuery) {
		andConditions.push({
			OR: [
				{
					code: {
						contains: normalizedQuery,
						mode: "insensitive" as const,
					},
				},
				{
					codePrefix: {
						contains: normalizedQuery,
						mode: "insensitive" as const,
					},
				},
				{
					redeemedBy: {
						is: {
							email: {
								contains: normalizedQuery,
								mode: "insensitive" as const,
							},
						},
					},
				},
				{
					redeemedBy: {
						is: {
							name: {
								contains: normalizedQuery,
								mode: "insensitive" as const,
							},
						},
					},
				},
			],
		});
	}

	if (planId && planId !== "all") {
		andConditions.push({
			batch: {
				planId,
			},
		});
	}

	if (batchId && batchId !== "all") {
		andConditions.push({
			batchId,
		});
	}

	if (redeemedFrom || redeemedTo) {
		andConditions.push({
			redeemedAt: {
				...(redeemedFrom ? { gte: redeemedFrom } : {}),
				...(redeemedTo ? { lte: redeemedTo } : {}),
			},
		});
	}

	if (status === "redeemed") {
		andConditions.push({
			status: "redeemed",
		});
	}

	if (status === "available") {
		andConditions.push({
			status: "available",
			OR: [
				{
					batch: {
						redeemBefore: null,
					},
				},
				{
					batch: {
						redeemBefore: {
							gte: now,
						},
					},
				},
			],
		});
	}

	if (status === "expired") {
		andConditions.push({
			status: "available",
			batch: {
				redeemBefore: {
					lt: now,
				},
			},
		});
	}

	return andConditions.length > 0 ? where : undefined;
}
