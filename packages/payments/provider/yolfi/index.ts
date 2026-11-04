import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@repo/database";

import { reportAdConversion } from "../../lib/ad-conversions";
import { resolvePaymentAttribution } from "../../lib/attribution";
import { claimPendingPurchases, upsertSubscriptionPurchase } from "../../lib/purchases";

interface YolfiEvent {
	created?: number;
	data?: { object?: Record<string, unknown> };
	id?: string;
	type?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function constantTimeBase64Equal(actual: string, expected: Buffer) {
	try {
		const actualBuffer = Buffer.from(actual, "base64");
		return actualBuffer.length === expected.length && timingSafeEqual(actualBuffer, expected);
	} catch {
		return false;
	}
}

function isValidSignature(rawBody: string, signature: string | null, secret: string) {
	if (!signature) return false;
	const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
	return constantTimeBase64Equal(signature, expected);
}

const DEFAULT_YOLFI_WEEKLY_PAYLINK_ID = "340ba658-394f-439c-9abc-36985d2383d3";
const DEFAULT_YOLFI_YEARLY_PAYLINK_ID = "75797130-8b5c-4814-8266-204472a4be16";

function getPaylinkIdFromUrl(paymentLink: string | undefined, fallbackId: string) {
	if (!paymentLink) return fallbackId;

	try {
		const url = new URL(paymentLink);
		if (url.protocol !== "https:") return null;
		const pathSegments = url.pathname.split("/").filter(Boolean);
		return pathSegments[pathSegments.length - 1] ?? null;
	} catch {
		return null;
	}
}

function getYolfiPaylinkPriceId(paylinkId: string | null) {
	const weeklyPaylinkId = getPaylinkIdFromUrl(
		process.env.NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK,
		DEFAULT_YOLFI_WEEKLY_PAYLINK_ID,
	);
	const yearlyPaylinkId = getPaylinkIdFromUrl(
		process.env.NEXT_PUBLIC_YOLFI_PRO_YEARLY_PAYMENT_LINK,
		DEFAULT_YOLFI_YEARLY_PAYLINK_ID,
	);

	if (paylinkId && paylinkId === weeklyPaylinkId) {
		return "yolfi_pro_weekly";
	}
	if (paylinkId && paylinkId === yearlyPaylinkId) {
		return "yolfi_pro_yearly";
	}
	return null;
}

function getObjectFromStripeEvent(event: YolfiEvent) {
	return asRecord(event.data?.object);
}

function getStripeMetadata(object: Record<string, unknown>) {
	const parent = asRecord(object.parent);
	const parentSubscriptionDetails = asRecord(parent.subscription_details);
	const subscriptionDetails = asRecord(object.subscription_details);
	return {
		...asRecord(parentSubscriptionDetails.metadata),
		...asRecord(subscriptionDetails.metadata),
		...asRecord(object.metadata),
	};
}

function getEmail(object: Record<string, unknown>) {
	const details = asRecord(object.customer_details);
	const billing = asRecord(object.billing_details);
	return (
		asString(object.customer_email) ??
		asString(object.receipt_email) ??
		asString(details.email) ??
		asString(billing.email)
	);
}

function getSubscriptionId(object: Record<string, unknown>, metadata: Record<string, unknown>) {
	const subscription = asRecord(object.subscription);
	return (
		asString(object.subscription) ??
		asString(subscription.id) ??
		asString(metadata.yolfi_subscription_id) ??
		(object.object === "subscription" ? asString(object.id) : null)
	);
}

function getPaylinkId(object: Record<string, unknown>, metadata: Record<string, unknown>) {
	return asString(metadata.yolfi_paylink_id) ?? asString(object.payment_link);
}

function getVisitorId(object: Record<string, unknown>, metadata: Record<string, unknown>) {
	return (
		asString(object.client_reference_id) ??
		asString(metadata.talivia_visitor_id) ??
		asString(metadata.visitor_id)
	);
}

export async function yolfiWebhookHandler(request: Request) {
	const secret = process.env.YOLFI_WEBHOOK_SECRET;
	if (!secret) {
		return new Response("YOLFI_WEBHOOK_SECRET is not configured", { status: 503 });
	}

	const rawBody = await request.text();
	if (!isValidSignature(rawBody, request.headers.get("X-Yolfi-Signature"), secret)) {
		return new Response("Invalid Yolfi signature", { status: 400 });
	}

	let event: YolfiEvent;
	try {
		event = JSON.parse(rawBody) as YolfiEvent;
	} catch {
		return new Response("Invalid JSON payload", { status: 400 });
	}

	if (!event.id || !event.type) {
		return new Response("Missing event id or type", { status: 400 });
	}

	const object = getObjectFromStripeEvent(event);
	const metadata = getStripeMetadata(object);
	const subscriptionId = getSubscriptionId(object, metadata);

	if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
		const paylinkId = getPaylinkId(object, metadata);
		const priceId = getYolfiPaylinkPriceId(paylinkId);
		if (!priceId) return new Response(null, { status: 204 });
		if (!subscriptionId) {
			return new Response("Unmapped or incomplete Yolfi subscription invoice", {
				status: 422,
			});
		}

		const attribution = await resolvePaymentAttribution(
			"yolfi",
			asString(metadata.attribution_id),
			event.created ?? Math.floor(Date.now() / 1000),
		);
		const existing = await db.purchase.findUnique({
			where: { subscriptionId },
			select: { status: true },
		});
		const status = existing?.status === "canceled" ? "canceled" : "active";
		const customerId = asString(object.customer) ?? `yolfi_${subscriptionId}`;

		await upsertSubscriptionPurchase({
			provider: "yolfi",
			...attribution,
			priceId,
			customerId,
			status,
			subscriptionId,
			customerEmail: getEmail(object),
			paymentLinkId: paylinkId,
			visitorId: getVisitorId(object, metadata),
		});

		const customerEmail = getEmail(object)?.trim().toLowerCase();
		if (customerEmail && status !== "canceled") {
			const account = await db.user.findUnique({
				where: { email: customerEmail },
				select: { id: true, emailVerified: true },
			});
			if (account?.emailVerified) {
				await claimPendingPurchases(account.id, customerEmail);
			}
		}
		// Stripe adapter expresses invoice amounts in currency minor units.
		// Missing/unknown amounts are deliberately not substituted with plan prices.
		if (
			typeof object.amount_paid === "number" &&
			typeof object.currency === "string" &&
			asString(object.id)
		) {
			try {
				await reportAdConversion({
					provider: "yolfi",
					paymentId: object.id as string,
					...attribution,
					amountMinor: object.amount_paid,
					currency: object.currency,
				});
			} catch {
				return new Response("Ad conversion pending; retry webhook", { status: 503 });
			}
		}
	} else if (
		event.type === "customer.subscription.deleted" ||
		event.type === "customer.subscription.updated" ||
		event.type === "invoice.payment_failed"
	) {
		const status =
			event.type === "customer.subscription.deleted"
				? "canceled"
				: asString(object.status) === "past_due" ||
					  asString(object.status) === "unpaid" ||
					  asString(object.status) === "overdue" ||
					  event.type === "invoice.payment_failed"
					? "past_due"
					: asString(object.status);
		if (subscriptionId && status) {
			if (event.type === "customer.subscription.deleted") {
				const paylinkId = getPaylinkId(object, metadata);
				const priceId = getYolfiPaylinkPriceId(paylinkId) ?? "yolfi_unmapped";
				await upsertSubscriptionPurchase({
					provider: "yolfi",
					priceId,
					customerId: asString(object.customer) ?? `yolfi_${subscriptionId}`,
					status,
					subscriptionId,
					customerEmail: getEmail(object),
					paymentLinkId: paylinkId,
					visitorId: getVisitorId(object, metadata),
				});
			} else {
				await db.purchase.updateMany({
					where: { subscriptionId, status: { not: "canceled" } },
					data: { status },
				});
			}
		}
	} else {
		return new Response(null, { status: 204 });
	}

	return new Response(null, { status: 204 });
}
