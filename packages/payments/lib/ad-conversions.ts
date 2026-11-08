import { db, recordFirstSubscriptionPayment } from "@repo/database";

const PROPELLERADS_TEMPLATE =
	"https://ad.propellerads.com/conversion.php?aid=3929518&pid=&tid=160672&visitor_id=${SUBID}&payout=${PAYOUT}&goal=1";
const ACQUISITION_GOAL = "first_purchase";

function isResolvedIdentifier(value: string | null | undefined): value is string {
	return Boolean(value?.trim()) && !/[{}$]/.test(value ?? "");
}

export function getPropellerAdsPostbackUrl(clickId: string, amountMinor: number, currency: string) {
	if (
		currency.toLowerCase() !== "usd" ||
		!Number.isSafeInteger(amountMinor) ||
		amountMinor <= 0 ||
		!isResolvedIdentifier(clickId)
	)
		return null;
	return PROPELLERADS_TEMPLATE.replace("${SUBID}", encodeURIComponent(clickId)).replace(
		"${PAYOUT}",
		(amountMinor / 100).toFixed(2),
	);
}

export function getAdsgramPostbackUrl(record: string, token: string | undefined) {
	if (!isResolvedIdentifier(record)) return null;
	if (!token?.trim()) throw new Error("ADSGRAM_CONVERSION_TOKEN is not configured");
	const url = new URL("https://api.adsgram.ai/confirm_conversion");
	url.searchParams.set("token", token);
	url.searchParams.set("record", record);
	// AdsGram documents 1=registration, 2=first purchase, 3=repeat purchase.
	url.searchParams.set("goaltype", "2");
	return url.toString();
}

interface ConversionInput {
	provider: string;
	paymentId: string;
	subscriptionId?: string | null;
	attributionId?: string | null;
	adPlatform?: string | null;
	adClickId?: string | null;
	adRecord?: string | null;
	amountMinor: number;
	currency: string;
}

/** Called only after signature verification and a confirmed paid event. Never trusts browser payout. */
export async function reportAdConversion(input: ConversionInput) {
	if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || !input.currency)
		return;
	// Record this even without advertising context, so a later renewal cannot become acquisition.
	if (
		input.subscriptionId &&
		!(await recordFirstSubscriptionPayment(
			input.provider,
			input.subscriptionId,
			input.paymentId,
		))
	)
		return;

	const adPlatform = input.adPlatform?.toLowerCase();
	const attributionId = input.attributionId;
	if (!attributionId) return;
	if (adPlatform === "propellerads") {
		if (!getPropellerAdsPostbackUrl(input.adClickId ?? "", input.amountMinor, input.currency))
			return;
	} else if (adPlatform === "adsgram") {
		if (!input.subscriptionId || !isResolvedIdentifier(input.adRecord)) return;
	} else return;

	const adRecord = adPlatform === "adsgram" ? input.adRecord : null;
	// Unique keys also cover different snapshots, subscriptions and payment providers sharing a record.
	const duplicates = [
		{ provider: input.provider, attributionId },
		{ provider: input.provider, paymentId: input.paymentId },
		...(input.subscriptionId
			? [
					{
						provider: input.provider,
						subscriptionId: input.subscriptionId,
						goal: ACQUISITION_GOAL,
					},
				]
			: []),
		...(adRecord ? [{ adPlatform, adRecord, goal: ACQUISITION_GOAL }] : []),
	];
	const conversion = await (async () => {
		try {
			return await db.adConversion.upsert({
				where: {
					provider_attributionId: {
						provider: input.provider,
						attributionId,
					},
				},
				create: {
					provider: input.provider,
					paymentId: input.paymentId,
					attributionId,
					subscriptionId: input.subscriptionId,
					adPlatform,
					adClickId: input.adClickId,
					adRecord,
					goal: ACQUISITION_GOAL,
					amountMinor: input.amountMinor,
					currency: input.currency.toLowerCase(),
					amountUsd:
						input.currency.toLowerCase() === "usd"
							? (input.amountMinor / 100).toFixed(2)
							: null,
				},
				update: {},
			});
		} catch (error) {
			if (!(error && typeof error === "object" && "code" in error && error.code === "P2002"))
				throw error;
			const existing = await db.adConversion.findFirst({ where: { OR: duplicates } });
			if (!existing) throw error;
			return existing;
		}
	})();
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
		// Retry the original task's immutable payload, never a later invoice's amount or click ID.
		const platform = conversion.adPlatform ?? adPlatform;
		const url =
			platform === "adsgram"
				? getAdsgramPostbackUrl(
						conversion.adRecord ?? adRecord ?? "",
						process.env.ADSGRAM_CONVERSION_TOKEN,
					)
				: getPropellerAdsPostbackUrl(
						conversion.adClickId ?? input.adClickId ?? "",
						conversion.amountMinor ?? Math.round(Number(conversion.amountUsd) * 100),
						conversion.currency ?? "usd",
					);
		if (!url) throw new Error("Invalid ad conversion payload");
		const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: "error" });
		if (!response.ok) throw new Error(`${platform} HTTP ${response.status}`);
		await db.adConversion.update({ where: { id: conversion.id }, data: { status: "sent" } });
	} catch (error) {
		// Never persist fetch errors containing the token-bearing URL.
		await db.adConversion.update({
			where: { id: conversion.id },
			data: {
				status: "failed",
				lastError:
					error instanceof Error &&
					error.message === "ADSGRAM_CONVERSION_TOKEN is not configured"
						? error.message
						: "Advertiser delivery failed; check configuration and retry webhook",
			},
		});
		throw new Error("Ad conversion delivery failed; retry webhook");
	}
}
