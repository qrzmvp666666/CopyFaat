import { db } from "../client";
import type { Prisma } from "../generated/client";

export function createCheckoutAttribution(data: Prisma.CheckoutAttributionCreateInput) {
	return db.checkoutAttribution.create({ data });
}

// A Stripe reference may be Talivia's session ID. Resolve the snapshot that existed
// when this particular checkout session was created, not the time of webhook delivery.
export function findCheckoutAttribution(
	provider: string,
	reference: string,
	createdAt: Date,
	paymentLinkUrl?: string,
) {
	return db.checkoutAttribution.findFirst({
		where: {
			provider,
			...(reference.startsWith("sf_") ? { id: reference } : { taliviaSessionId: reference }),
			...(paymentLinkUrl ? { paymentLinkUrl } : {}),
			createdAt: { lte: createdAt },
		},
		orderBy: { createdAt: "desc" },
	});
}

/** The first positive paid event owns acquisition; renewals cannot reopen it. */
export async function recordFirstSubscriptionPayment(
	provider: string,
	subscriptionId: string,
	paymentId: string,
) {
	await db.purchase.updateMany({
		where: { provider, subscriptionId, firstPaidPaymentId: null },
		data: { firstPaidPaymentId: paymentId },
	});
	const purchase = await db.purchase.findUnique({
		where: { subscriptionId },
		select: { provider: true, firstPaidPaymentId: true },
	});
	if (!purchase || purchase.provider !== provider) {
		throw new Error("Subscription purchase is not available; retry webhook");
	}
	return purchase.firstPaidPaymentId === paymentId;
}
