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
