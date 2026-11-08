import { findCheckoutAttribution } from "@repo/database";

export async function resolvePaymentAttribution(
	provider: string,
	reference: string | null | undefined,
	checkoutCreatedAt: number,
	paymentLinkUrl?: string,
) {
	if (!reference) return {};
	const record = await findCheckoutAttribution(
		provider,
		reference,
		new Date(checkoutCreatedAt * 1000 + 999),
		paymentLinkUrl,
	);
	if (!record) return {};
	return {
		attributionId: record.id,
		adPlatform: record.adPlatform,
		adClickId: record.adClickId,
		adRecord: record.adRecord,
		taliviaVisitorId: record.taliviaVisitorId,
		taliviaSessionId: record.taliviaSessionId,
	};
}
