import { createPurchase, db, getPurchaseBySubscriptionId, updatePurchase } from "@repo/database";
import { logger } from "@repo/logs";
import Stripe from "stripe";

import { setCustomerIdToEntity } from "../../lib/customer";
import { claimPendingPurchases, upsertSubscriptionPurchase } from "../../lib/purchases";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
	if (stripeClient) {
		return stripeClient;
	}

	const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;

	if (!stripeSecretKey) {
		throw new Error("Missing env variable STRIPE_SECRET_KEY");
	}

	stripeClient = new Stripe(stripeSecretKey);

	return stripeClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const stripeClient = getStripeClient();
	const {
		type,
		priceId,
		redirectUrl,
		customerId,
		organizationId,
		userId,
		trialPeriodDays,
		seats,
		email,
	} = options;

	const metadata = {
		organization_id: organizationId || null,
		user_id: userId || null,
	};

	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		mode: type === "subscription" ? "subscription" : "payment",
		success_url: redirectUrl ?? "",
		line_items: [
			{
				quantity: seats ?? 1,
				price: priceId,
			},
		],
		...(customerId ? { customer: customerId } : { customer_email: email }),
		...(type === "one-time"
			? {
					payment_intent_data: {
						metadata,
					},
					...(customerId ? {} : { customer_creation: "always" as const }),
				}
			: {
					subscription_data: {
						metadata,
						trial_period_days: trialPeriodDays,
					},
				}),
		metadata,
	};

	const response = await createCheckoutSession(stripeClient, sessionParams, email);

	return response.url;
};

async function createCheckoutSession(
	stripeClient: Stripe,
	params: Stripe.Checkout.SessionCreateParams,
	fallbackCustomerEmail?: string,
) {
	try {
		return await stripeClient.checkout.sessions.create(params);
	} catch (error) {
		if (params.customer && isMissingCustomerError(error)) {
			const { customer: _customer, ...retryParams } = params;

			return stripeClient.checkout.sessions.create({
				...retryParams,
				...(fallbackCustomerEmail ? { customer_email: fallbackCustomerEmail } : {}),
				...(params.mode === "payment" ? { customer_creation: "always" as const } : {}),
			});
		}

		throw error;
	}
}

function isMissingCustomerError(error: unknown) {
	const stripeError = error as { type?: string; param?: string; message?: string };

	return (
		stripeError.type === "StripeInvalidRequestError" &&
		stripeError.param === "customer" &&
		(stripeError.message ?? "").toLowerCase().includes("no such customer")
	);
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
	const invoiceRecord = invoice as unknown as Record<string, unknown>;
	const directSubscription = invoiceRecord.subscription;
	if (typeof directSubscription === "string") return directSubscription;
	if (directSubscription && typeof directSubscription === "object") {
		const id = (directSubscription as { id?: unknown }).id;
		if (typeof id === "string") return id;
	}

	const parent = invoiceRecord.parent as
		| { subscription_details?: { subscription?: unknown } }
		| undefined;
	const parentSubscription = parent?.subscription_details?.subscription;
	if (typeof parentSubscription === "string") return parentSubscription;
	if (parentSubscription && typeof parentSubscription === "object") {
		const id = (parentSubscription as { id?: unknown }).id;
		if (typeof id === "string") return id;
	}
	return null;
}

function getStripePaymentLinkId(paymentLink: string | Stripe.PaymentLink | null | undefined) {
	if (typeof paymentLink === "string") return paymentLink;
	return paymentLink?.id ?? null;
}

function normalizePaymentLinkUrl(paymentLink: string | null | undefined) {
	if (!paymentLink) return null;

	try {
		const url = new URL(paymentLink);
		if (url.protocol !== "https:") return null;
		return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
	} catch {
		return null;
	}
}

async function getStripePaymentLinkPriceId(stripeClient: Stripe, paymentLinkId: string | null) {
	if (!paymentLinkId) return null;

	const paymentLink = await stripeClient.paymentLinks.retrieve(paymentLinkId);
	const actualUrl = normalizePaymentLinkUrl(paymentLink.url);
	if (!actualUrl) return null;

	if (
		actualUrl ===
		normalizePaymentLinkUrl(process.env.NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK)
	) {
		return "stripe_pro_weekly";
	}
	if (
		actualUrl ===
		normalizePaymentLinkUrl(process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK)
	) {
		return "stripe_pro_yearly";
	}
	return null;
}

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
	redirectUrl,
}) => {
	const stripeClient = getStripeClient();

	const response = await stripeClient.billingPortal.sessions.create({
		customer: customerId,
		return_url: redirectUrl ?? "",
	});

	return response.url;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({ id, seats }) => {
	const stripeClient = getStripeClient();

	const subscription = await stripeClient.subscriptions.retrieve(id);

	if (!subscription) {
		throw new Error("Subscription not found.");
	}

	await stripeClient.subscriptions.update(id, {
		items: [
			{
				id: subscription.items.data[0].id,
				quantity: seats,
			},
		],
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	const stripeClient = getStripeClient();

	await stripeClient.subscriptions.cancel(id);
};

export const webhookHandler: WebhookHandler = async (req) => {
	const stripeClient = getStripeClient();

	if (!req.body) {
		return new Response("Invalid request.", {
			status: 400,
		});
	}

	let event: Stripe.Event | undefined;

	try {
		event = await stripeClient.webhooks.constructEventAsync(
			await req.text(),
			req.headers.get("stripe-signature") as string,
			process.env.STRIPE_WEBHOOK_SECRET as string,
		);
	} catch (e) {
		logger.error(e);

		return new Response("Invalid request.", {
			status: 400,
		});
	}

	try {
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object;
				const { mode, metadata, customer } = session;

				if (mode === "subscription") {
					const subscriptionId =
						typeof session.subscription === "string"
							? session.subscription
							: session.subscription?.id;
					if (!subscriptionId) {
						return new Response("Missing subscription ID.", { status: 422 });
					}

					const customerId = typeof customer === "string" ? customer : customer?.id;
					const paymentLinkId = getStripePaymentLinkId(session.payment_link);
					const priceId = await getStripePaymentLinkPriceId(stripeClient, paymentLinkId);
					if (!priceId) {
						return new Response("Unmapped Stripe Payment Link.", { status: 422 });
					}

					const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
					const stripeCustomerEmail =
						session.customer_details?.email ?? session.customer_email;

					await upsertSubscriptionPurchase({
						provider: "stripe",
						priceId,
						customerId: customerId ?? `stripe_${subscriptionId}`,
						status: subscription.status,
						subscriptionId,
						userId: metadata?.user_id,
						customerEmail: stripeCustomerEmail,
						paymentLinkId,
						visitorId: session.client_reference_id,
					});

					if (stripeCustomerEmail && !metadata?.user_id) {
						const account = await db.user.findUnique({
							where: { email: stripeCustomerEmail.trim().toLowerCase() },
							select: { id: true, emailVerified: true },
						});
						if (account?.emailVerified) {
							await claimPendingPurchases(account.id, stripeCustomerEmail);
						}
					}

					if (customerId && metadata?.user_id) {
						await setCustomerIdToEntity(customerId, {
							organizationId: metadata.organization_id,
							userId: metadata.user_id,
						});
					}
					break;
				}

				const paymentLinkId = getStripePaymentLinkId(session.payment_link);
				const priceId = await getStripePaymentLinkPriceId(stripeClient, paymentLinkId);
				if (!priceId) {
					return new Response("Unmapped Stripe Payment Link.", { status: 422 });
				}

				await createPurchase({
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
					customerId: customer as string,
					type: "ONE_TIME",
					priceId,
					paymentLinkId,
					visitorId: session.client_reference_id,
				});

				await setCustomerIdToEntity(customer as string, {
					organizationId: metadata?.organization_id,
					userId: metadata?.user_id,
				});

				break;
			}
			case "customer.subscription.created": {
				const subscription = event.data.object;
				const existingPurchase = await getPurchaseBySubscriptionId(subscription.id);
				if (existingPurchase) {
					await updatePurchase({ id: existingPurchase.id, status: subscription.status });
				}

				break;
			}
			case "customer.subscription.updated": {
				const subscription = event.data.object;
				const subscriptionId = subscription.id;

				const existingPurchase = await getPurchaseBySubscriptionId(subscriptionId);

				if (existingPurchase && existingPurchase.status !== "canceled") {
					await updatePurchase({
						id: existingPurchase.id,
						status: event.data.object.status,
					});
				}

				break;
			}
			case "customer.subscription.deleted": {
				const subscription = event.data.object;
				const existingPurchase = await getPurchaseBySubscriptionId(subscription.id);
				if (existingPurchase) {
					await updatePurchase({ id: existingPurchase.id, status: "canceled" });
				}

				break;
			}
			case "invoice.payment_failed": {
				const subscriptionId = getInvoiceSubscriptionId(event.data.object);
				if (subscriptionId) {
					await db.purchase.updateMany({
						where: { subscriptionId, status: { not: "canceled" } },
						data: { status: "past_due" },
					});
				}

				break;
			}
			case "invoice.paid": {
				const subscriptionId = getInvoiceSubscriptionId(event.data.object);
				if (subscriptionId) {
					const existingPurchase = await getPurchaseBySubscriptionId(subscriptionId);
					if (existingPurchase && existingPurchase.status !== "canceled") {
						const subscription =
							await stripeClient.subscriptions.retrieve(subscriptionId);
						await updatePurchase({
							id: existingPurchase.id,
							status: subscription.status,
						});
					}
				}

				break;
			}

			default:
				return new Response("Unhandled event type.", {
					status: 200,
				});
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(`Webhook error: ${error instanceof Error ? error.message : ""}`, {
			status: 400,
		});
	}
};
