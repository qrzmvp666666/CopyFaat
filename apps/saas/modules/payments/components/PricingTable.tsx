"use client";

import { usePlanData } from "@payments/hooks/plan-data";
import type { PlanId } from "@payments/types";
import { config as paymentsConfig } from "@repo/payments/config";
import type { PaidPlan } from "@repo/payments/types";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { AlipayIcon, StripeIcon, WeChatIcon } from "@repo/ui/components/payment-brand-icons";
import { RedeemCodePurchaseLink } from "@repo/ui/components/redeem-code-purchase-link";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { toastError } from "@repo/ui/components/toast";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { ArrowRightIcon, BadgePercentIcon, CheckIcon, GiftIcon, StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useState } from "react";

const plans = paymentsConfig.plans;
const visiblePaidPlanIds = ["pro", "lifetime"] as const;

type VisiblePaidPlanId = (typeof visiblePaidPlanIds)[number];
type PaymentMethodMark = "card" | "alipay_person" | "wechat_person" | "redeem";

interface PlanSelection {
	type: "one-time" | "subscription";
	interval?: "month" | "year";
}

interface DisplayPlan {
	id: VisiblePaidPlanId;
	title: string;
	description: ReactNode;
	features: ReactNode[];
	price?: PaidPlan["prices"][number];
	priceLabel?: string;
	recommended?: boolean;
	paymentMethods: PaymentMethodMark[];
}

function getMonthlyEquivalent(price: PaidPlan["prices"][number]): number | undefined {
	if (price.type !== "subscription" || price.interval !== "year") {
		return undefined;
	}

	return price.amount / 12;
}

function getVisiblePlanIds(activePlanId?: string, showActivePlanInPricing = false) {
	if (activePlanId === "lifetime") {
		return [];
	}

	if (activePlanId === "pro" && !showActivePlanInPricing) {
		return ["lifetime"] satisfies VisiblePaidPlanId[];
	}

	return ["pro", "lifetime"] satisfies VisiblePaidPlanId[];
}

function getPaymentMethodsForPlan(planId: VisiblePaidPlanId): PaymentMethodMark[] {
	if (planId === "lifetime") {
		return ["card", "alipay_person", "wechat_person", "redeem"];
	}

	return ["card", "redeem"];
}

function PaymentMethodMarks({ methods }: { methods: PaymentMethodMark[] }) {
	const paymentMethods: Record<
		PaymentMethodMark,
		{
			label: string;
			icon: ComponentType<SVGProps<SVGSVGElement>>;
			className: string;
		}
	> = {
		card: {
			label: "Stripe",
			icon: StripeIcon,
			className: "h-5 w-7 text-[#635BFF]",
		},
		alipay_person: {
			label: "支付宝",
			icon: AlipayIcon,
			className: "size-5 text-[#1677FF]",
		},
		wechat_person: {
			label: "微信",
			icon: WeChatIcon,
			className: "size-5 text-[#07C160]",
		},
		redeem: {
			label: "兑换码",
			icon: GiftIcon,
			className: "size-5 text-foreground/45",
		},
	};

	return (
		<div className="gap-3 flex shrink-0 items-center" aria-label="支持的支付与兑换方式">
			{methods.map((method) => {
				const paymentMethod = paymentMethods[method];
				const Icon = paymentMethod.icon;

				return (
					<span key={method} className="inline-flex" title={paymentMethod.label}>
						<Icon className={paymentMethod.className} aria-hidden="true" />
					</span>
				);
			})}
		</div>
	);
}

export function PricingTable({
	className,
	userId,
	organizationId,
	activePlanId,
	showActivePlanInPricing,
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	showActivePlanInPricing?: boolean;
}) {
	const t = useTranslations();
	const xianyuRedeemT = useTranslations("pricing.xianyuRedeem");
	const format = useFormatter();
	const router = useRouter();
	const [loading, setLoading] = useState<PlanId | false>(false);
	const [interval, setInterval] = useState<"month" | "year">("month");

	const { planData } = usePlanData();
	const visiblePlanIds = getVisiblePlanIds(activePlanId, showActivePlanInPricing);

	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const onSelectPlan = async (planId: PlanId, selection?: PlanSelection) => {
		if (!(userId || organizationId)) {
			router.push("/signup");
			return;
		}

		if (!selection) {
			return;
		}

		setLoading(planId);

		try {
			const { checkoutLink } = await createCheckoutLinkMutation.mutateAsync({
				planId,
				type: selection.type,
				interval: selection.interval,
				organizationId,
				paymentMethod: "card",
				redirectUrl: organizationId
					? `${window.location.origin}/checkout-return?organizationId=${organizationId}`
					: `${window.location.origin}/checkout-return`,
			});

			window.location.href = checkoutLink;
		} catch (error) {
			console.error(error);
			toastError(
				"支付失败",
				error instanceof Error ? error.message : "发起支付时出错，请稍后重试",
			);
		} finally {
			setLoading(false);
		}
	};

	const displayPlans: DisplayPlan[] = [
		...Object.entries(plans).flatMap(([planId, plan]) => {
			const visiblePlanId = planId as VisiblePaidPlanId;

			if (!visiblePlanIds.includes(visiblePlanId)) return [];
			if (!("prices" in plan)) return [];

			const typedPlan = plan as PaidPlan;
			const planDataEntry = planData[planId as keyof typeof planData];

			if (!planDataEntry || typedPlan.hidden) {
				return [];
			}

			const price = typedPlan.prices.find(
				(price) =>
					(price.type === "one-time" || price.interval === interval) &&
					(price.paymentMethod ?? "card") === "card",
			);

			if (!price) {
				return [];
			}

			const rawPrice = t.raw(`pricing.products.${planId}.price`) as
				| string
				| Record<string, string>;
			const priceLabel = typeof rawPrice === "string" ? rawPrice : rawPrice[interval];

			return [
				{
					id: visiblePlanId,
					title: planDataEntry.title,
					description: planDataEntry.description,
					features: planDataEntry.features,
					price,
					priceLabel,
					recommended: typedPlan.recommended,
					paymentMethods: getPaymentMethodsForPlan(visiblePlanId),
				},
			];
		}),
	];
	const hasSubscriptions = displayPlans.some((plan) => plan.price?.type === "subscription");

	if (displayPlans.length === 0) {
		return null;
	}

	return (
		<div className={cn("@container", className)}>
			{hasSubscriptions && (
				<div className="mb-6 flex justify-center">
					<Tabs
						value={interval}
						onValueChange={(value) => setInterval(value as typeof interval)}
						data-test="price-table-interval-tabs"
					>
						<TabsList className="border-foreground/10">
							<TabsTrigger value="month">{t("pricing.monthly")}</TabsTrigger>
							<TabsTrigger value="year">{t("pricing.yearly")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			)}

			<div
				className={cn(
					"gap-4 mx-auto grid grid-cols-1",
					displayPlans.length <= 2
						? "max-w-4xl md:grid-cols-2"
						: "max-w-6xl md:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{displayPlans.map((plan) => {
					const monthlyEquivalent = plan.price
						? getMonthlyEquivalent(plan.price)
						: undefined;
					const intervalLabel =
						plan.price && "interval" in plan.price
							? interval === "month"
								? t("pricing.month", {
										count: 1,
									})
								: t("pricing.year", {
										count: 1,
									})
							: undefined;
					const trialPeriodDays =
						plan.price && "trialPeriodDays" in plan.price
							? plan.price.trialPeriodDays
							: undefined;

					return (
						<div
							key={plan.id}
							className={cn("p-6 rounded-3xl border-[3px] bg-card", {
								"border-primary": plan.recommended,
							})}
							data-test="price-table-plan"
						>
							<div className="gap-4 flex h-full flex-col justify-between">
								<div>
									{plan.recommended && (
										<div className="-mt-9 flex justify-center">
											<div className="mb-2 h-7 gap-1.5 px-3 py-1 font-semibold text-xs shadow-sm border-white bg-white text-black flex w-auto items-center rounded-full border">
												<StarIcon className="size-3.5" />
												{t("pricing.recommended")}
											</div>
										</div>
									)}
									<div className="gap-3 flex items-start justify-between">
										<h3
											className={cn("my-0 font-semibold text-2xl", {
												"font-bold text-primary": plan.recommended,
											})}
										>
											{plan.title}
										</h3>
										{plan.price && (
											<PaymentMethodMarks methods={plan.paymentMethods} />
										)}
									</div>

									{plan.priceLabel && (
										<strong
											className="font-medium text-2xl mt-2 block whitespace-nowrap"
											data-test="price-table-plan-price"
										>
											{plan.priceLabel}
										</strong>
									)}

									{!plan.priceLabel && plan.price && (
										<div className="mt-2">
											<strong
												className="font-medium text-2xl block whitespace-nowrap"
												data-test="price-table-plan-price"
											>
												{format.number(plan.price.amount, {
													style: "currency",
													currency: plan.price.currency,
												})}
												{intervalLabel && (
													<span className="font-normal text-xs opacity-60">
														{" / "}
														{intervalLabel}
													</span>
												)}
												{organizationId &&
													"seatBased" in plan.price &&
													plan.price.seatBased && (
														<span className="font-normal text-xs opacity-60">
															{" / "}
															{t("pricing.perSeat")}
														</span>
													)}
											</strong>

											{monthlyEquivalent !== undefined && (
												<p className="mt-1 text-sm text-primary">
													{t("pricing.monthlyEquivalent", {
														price: format.number(monthlyEquivalent, {
															style: "currency",
															currency: plan.price.currency,
															maximumFractionDigits: 1,
														}),
													})}
												</p>
											)}
										</div>
									)}

									{plan.description && (
										<div className="prose mt-2 text-sm text-foreground/60">
											{plan.description}
										</div>
									)}

									{!!plan.features?.length && (
										<ul className="mt-4 gap-2 text-sm grid list-none">
											{plan.features.map((feature, key) => (
												<li
													key={key}
													className="flex items-center justify-start"
												>
													<CheckIcon className="mr-2 size-4 text-primary" />
													<span>{feature}</span>
												</li>
											))}
										</ul>
									)}

									{trialPeriodDays !== undefined && trialPeriodDays > 0 && (
										<div className="mt-4 font-medium text-sm flex items-center justify-start text-primary opacity-80">
											<BadgePercentIcon className="mr-2 size-4" />
											{t("pricing.trialPeriod", {
												days: trialPeriodDays,
											})}
										</div>
									)}
								</div>

								<div>
									{plan.price && (
										<div className="mb-3">
											<RedeemCodePurchaseLink
												ariaLabel={xianyuRedeemT("ariaLabel")}
												description={xianyuRedeemT("description")}
												imageAlt={xianyuRedeemT("imageAlt")}
												label={xianyuRedeemT("label")}
												title={xianyuRedeemT("title")}
											/>
										</div>
									)}
									<Button
										className="mt-4 w-full"
										variant="primary"
										onClick={() =>
											plan.price &&
											onSelectPlan(plan.id as PlanId, {
												type:
													plan.price.type === "one-time"
														? "one-time"
														: "subscription",
												interval:
													plan.price.type === "subscription"
														? plan.price.interval
														: undefined,
											})
										}
										disabled={!plan.price}
										loading={loading === plan.id}
									>
										{plan.price
											? userId || organizationId
												? plan.id === "pro"
													? t("pricing.payNow")
													: t("pricing.choosePlan")
												: t("pricing.getStarted")
											: t("pricing.included")}
										{plan.price && <ArrowRightIcon className="ml-2 size-4" />}
									</Button>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
