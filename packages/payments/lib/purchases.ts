import { db } from "@repo/database";

interface UpsertSubscriptionPurchaseInput {
	provider: string;
	priceId: string;
	customerId: string;
	status: string;
	userId?: string | null;
	customerEmail?: string | null;
	subscriptionId: string;
	paymentLinkId?: string | null;
	visitorId?: string | null;
	attributionId?: string | null;
	adPlatform?: string | null;
	adClickId?: string | null;
	adRecord?: string | null;
	taliviaVisitorId?: string | null;
	taliviaSessionId?: string | null;
}

export async function upsertSubscriptionPurchase(input: UpsertSubscriptionPurchaseInput) {
	const existing = await db.purchase.findUnique({
		where: { subscriptionId: input.subscriptionId },
		select: { id: true, userId: true, status: true },
	});
	const canAttachUser = !existing?.userId || existing.userId === input.userId;
	const attribution = Object.fromEntries(
		Object.entries({
			attributionId: input.attributionId,
			adPlatform: input.adPlatform,
			adClickId: input.adClickId,
			adRecord: input.adRecord,
			taliviaVisitorId: input.taliviaVisitorId,
			taliviaSessionId: input.taliviaSessionId,
		}).filter(([, value]) => value != null),
	);
	const customerEmail = input.customerEmail?.trim().toLowerCase();

	return db.purchase.upsert({
		where: { subscriptionId: input.subscriptionId },
		create: {
			...attribution,
			type: "SUBSCRIPTION",
			provider: input.provider,
			claimStatus: input.userId ? "claimed" : "pending",
			userId: input.userId ?? null,
			customerId: input.customerId,
			customerEmail: customerEmail ?? null,
			subscriptionId: input.subscriptionId,
			paymentLinkId: input.paymentLinkId ?? null,
			visitorId: input.visitorId ?? null,
			priceId: input.priceId,
			status: input.status,
		},
		update: {
			...attribution,
			provider: input.provider,
			customerId: input.customerId,
			...(canAttachUser && input.userId
				? { userId: input.userId, claimStatus: "claimed" }
				: {}),
			...(customerEmail ? { customerEmail } : {}),
			...(input.paymentLinkId ? { paymentLinkId: input.paymentLinkId } : {}),
			...(input.visitorId ? { visitorId: input.visitorId } : {}),
			priceId: input.priceId,
			status: existing?.status === "canceled" ? "canceled" : input.status,
		},
	});
}

export async function claimPendingPurchases(userId: string, email: string) {
	const normalizedEmail = email.trim().toLowerCase();
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { email: true, emailVerified: true },
	});

	if (!user?.emailVerified || user.email.trim().toLowerCase() !== normalizedEmail) {
		return 0;
	}

	const pendingPurchases = await db.purchase.findMany({
		where: {
			userId: null,
			claimStatus: "pending",
			customerEmail: normalizedEmail,
			type: "SUBSCRIPTION",
			status: { in: ["active", "trialing"] },
		},
		select: { id: true },
	});

	let claimedCount = 0;
	for (const purchase of pendingPurchases) {
		const result = await db.purchase.updateMany({
			where: { id: purchase.id, userId: null, claimStatus: "pending" },
			data: { userId, claimStatus: "claimed" },
		});
		claimedCount += result.count;
	}

	return claimedCount;
}
