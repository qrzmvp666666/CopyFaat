import type { z } from "zod";

import { db } from "../client";
import type { PurchaseSchema } from "../zod";

export async function getPurchaseById(id: string) {
	return db.purchase.findUnique({
		where: { id },
	});
}

export async function getPurchasesByOrganizationId(organizationId: string) {
	return db.purchase.findMany({
		where: {
			organizationId,
		},
	});
}

export async function getPurchasesByUserId(userId: string) {
	return db.purchase.findMany({
		where: {
			userId,
		},
	});
}

export async function getPurchaseBySubscriptionId(subscriptionId: string) {
	return db.purchase.findFirst({
		where: {
			subscriptionId,
		},
	});
}

type PurchaseInsert = Omit<
	z.infer<typeof PurchaseSchema>,
	"id" | "createdAt" | "updatedAt" | "provider" | "claimStatus"
> &
	Partial<Pick<z.infer<typeof PurchaseSchema>, "provider" | "claimStatus">>;

export async function createPurchase(purchase: PurchaseInsert) {
	const created = await db.purchase.create({
		data: {
			provider: "stripe",
			claimStatus: purchase.userId ? "claimed" : "pending",
			...purchase,
		},
	});

	return getPurchaseById(created.id);
}

export async function updatePurchase(
	purchase: Partial<Omit<z.infer<typeof PurchaseSchema>, "createdAt" | "updatedAt">> & {
		id: string;
	},
) {
	const updated = await db.purchase.update({
		where: {
			id: purchase.id,
		},
		data: purchase,
	});

	return getPurchaseById(updated.id);
}

export async function deletePurchaseBySubscriptionId(subscriptionId: string) {
	await db.purchase.delete({
		where: {
			subscriptionId,
		},
	});
}
