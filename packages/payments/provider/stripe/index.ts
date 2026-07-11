import {
	createPurchase,
	deletePurchaseBySubscriptionId,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";
import Stripe from "stripe";

import { setCustomerIdToEntity } from "../../lib/customer";
import {
	recordMembershipAnalyticsEvent,
	MEMBERSHIP_ANALYTICS_EVENTS,
	syncMembershipAnalyticsProfile,
} from "../../lib/mixpanel";
import { getPlanIdByProviderPriceId } from "../../lib/provider-price-ids";
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
				const { mode, metadata, customer, id } = event.data.object;

				if (mode === "subscription") {
					break;
				}

				const checkoutSession = await stripeClient.checkout.sessions.retrieve(id, {
					expand: ["line_items"],
				});

				const priceId = checkoutSession.line_items?.data[0].price?.id;
				const planId = priceId ? getPlanIdByProviderPriceId(priceId) : null;

				if (!planId || !priceId) {
					return new Response("Missing plan or price ID.", {
						status: 400,
					});
				}

				const purchase = await createPurchase({
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
					customerId: customer as string,
					type: "ONE_TIME",
					priceId,
				});

				if (purchase?.userId) {
					await recordMembershipAnalyticsEvent(
						purchase.userId,
						MEMBERSHIP_ANALYTICS_EVENTS.PAID,
						{ insertId: `stripe-checkout:${id}` },
					);
				}

				await setCustomerIdToEntity(customer as string, {
					organizationId: metadata?.organization_id,
					userId: metadata?.user_id,
				});

				break;
			}
			case "customer.subscription.created": {
				const { metadata, customer, items, id } = event.data.object;

				const priceId = items?.data[0].price?.id;
				const planId = priceId ? getPlanIdByProviderPriceId(priceId) : null;

				if (!planId || !priceId) {
					return new Response("Missing plan or price ID.", {
						status: 400,
					});
				}

				const purchase = await createPurchase({
					subscriptionId: id,
					organizationId: metadata?.organization_id || null,
					userId: metadata?.user_id || null,
					customerId: customer as string,
					type: "SUBSCRIPTION",
					priceId,
					status: event.data.object.status,
				});

				if (purchase?.userId) {
					if (purchase.status === "active") {
						await recordMembershipAnalyticsEvent(
							purchase.userId,
							MEMBERSHIP_ANALYTICS_EVENTS.PAID,
							{ insertId: `stripe-subscription:${id}:paid` },
						);
					} else if (purchase.status === "trialing") {
						await recordMembershipAnalyticsEvent(
							purchase.userId,
							MEMBERSHIP_ANALYTICS_EVENTS.TRIAL_STARTED,
							{ insertId: `stripe-subscription:${id}:trial` },
						);
					} else {
						await syncMembershipAnalyticsProfile(purchase.userId);
					}
				}

				await setCustomerIdToEntity(customer as string, {
					organizationId: metadata?.organization_id,
					userId: metadata?.user_id,
				});

				break;
			}
			case "customer.subscription.updated": {
				const subscriptionId = event.data.object.id;

				const existingPurchase = await getPurchaseBySubscriptionId(subscriptionId);

				if (existingPurchase) {
					const priceId = event.data.object.items?.data[0].price?.id;
					const previousStatus = existingPurchase.status;

					await updatePurchase({
						id: existingPurchase.id,
						status: event.data.object.status,
						...(priceId ? { priceId } : {}),
					});

					if (existingPurchase.userId) {
						if (event.data.object.status === "active" && previousStatus !== "active") {
							await recordMembershipAnalyticsEvent(
								existingPurchase.userId,
								MEMBERSHIP_ANALYTICS_EVENTS.PAID,
								{ insertId: `stripe-subscription:${subscriptionId}:paid` },
							);
						} else {
							await syncMembershipAnalyticsProfile(existingPurchase.userId);
						}
					}
				}

				break;
			}
			case "customer.subscription.deleted": {
				const existingPurchase = await getPurchaseBySubscriptionId(event.data.object.id);

				await deletePurchaseBySubscriptionId(event.data.object.id);

				if (existingPurchase?.userId) {
					await syncMembershipAnalyticsProfile(existingPurchase.userId);
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
