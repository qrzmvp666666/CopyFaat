import { db } from "@repo/database";

const PROPELLERADS_TEMPLATE =
	"https://ad.propellerads.com/conversion.php?aid=3929518&pid=&tid=160672&visitor_id=${SUBID}&payout=${PAYOUT}&goal=1";

export function getPropellerAdsPostbackUrl(clickId: string, amountMinor: number, currency: string) {
	if (
		currency.toLowerCase() !== "usd" ||
		!Number.isSafeInteger(amountMinor) ||
		amountMinor <= 0 ||
		!clickId ||
		/[{}$]/.test(clickId)
	)
		return null;
	return PROPELLERADS_TEMPLATE.replace("${SUBID}", encodeURIComponent(clickId)).replace(
		"${PAYOUT}",
		(amountMinor / 100).toFixed(2),
	);
}

interface ConversionInput {
	provider: string;
	paymentId: string;
	attributionId?: string | null;
	adPlatform?: string | null;
	adClickId?: string | null;
	amountMinor: number;
	currency: string;
}

/** Called only after signature verification and a confirmed paid event. Never trusts browser payout. */
export async function reportAdConversion(input: ConversionInput) {
	if (
		input.adPlatform?.toLowerCase() !== "propellerads" ||
		!input.attributionId ||
		!input.adClickId
	)
		return;
	const url = getPropellerAdsPostbackUrl(input.adClickId, input.amountMinor, input.currency);
	if (!url) return; // No guessed FX rates, zero-value trials, or unresolved ad macros.
	const conversion = await db.adConversion.upsert({
		where: {
			provider_attributionId: {
				provider: input.provider,
				attributionId: input.attributionId,
			},
		},
		create: {
			provider: input.provider,
			paymentId: input.paymentId,
			attributionId: input.attributionId,
			amountUsd: (input.amountMinor / 100).toFixed(2),
		},
		update: {},
	});
	if (conversion.status === "sent") return;
	// Compare-and-set with a lease prevents concurrent webhook deliveries sending twice.
	const acquired = await db.adConversion.updateMany({
		where: {
			id: conversion.id,
			OR: [
				{ status: { in: ["pending", "failed"] } },
				{ status: "sending", updatedAt: { lt: new Date(Date.now() - 60000) } },
			],
		},
		data: { status: "sending", attempts: { increment: 1 }, lastError: null },
	});
	if (!acquired.count)
		throw new Error("Ad conversion delivery is already in progress; retry later");
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
		if (!response.ok) throw new Error(`PropellerAds HTTP ${response.status}`);
		await db.adConversion.update({ where: { id: conversion.id }, data: { status: "sent" } });
	} catch (error) {
		await db.adConversion.update({
			where: { id: conversion.id },
			data: {
				status: "failed",
				lastError: error instanceof Error ? error.message.slice(0, 300) : "Delivery failed",
			},
		});
		throw new Error("Ad conversion delivery failed; retry webhook");
	}
}
