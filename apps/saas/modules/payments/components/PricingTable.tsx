"use client";

import { usePlanData } from "@payments/hooks/plan-data";
import type { PlanId } from "@payments/types";
import { config as paymentsConfig } from "@repo/payments/config";
import type { PaidPlan } from "@repo/payments/types";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { toastError } from "@repo/ui/components/toast";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import {
	ArrowRightIcon,
	BadgePercentIcon,
	CheckIcon,
	CreditCardIcon,
	StarIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useState } from "react";

const plans = paymentsConfig.plans;
const visiblePaidPlanIds = ["pro", "lifetime"] as const;

type VisiblePaidPlanId = (typeof visiblePaidPlanIds)[number];
type PaymentMethodMark = "card";
type SubscriptionPlanPrice = Extract<PaidPlan["prices"][number], { type: "subscription" }>;

interface PlanSelection {
	type: "one-time" | "subscription";
	interval?: "week" | "year";
}

interface DisplayPlan {
	id: VisiblePaidPlanId;
	title: string;
	description: ReactNode;
	features: ReactNode[];
	price?: PaidPlan["prices"][number];
	weeklyPrice?: SubscriptionPlanPrice;
	yearlyPrice?: SubscriptionPlanPrice;
	recommended?: boolean;
	paymentMethods: PaymentMethodMark[];
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

function getPaymentMethodsForPlan(): PaymentMethodMark[] {
	return ["card"];
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
			label: "银行卡/信用卡",
			icon: CreditCardIcon,
			className: "size-5 text-foreground/70",
		},
	};

	return (
		<div className="gap-3 flex shrink-0 items-center" aria-label="支持的支付方式">
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
	const format = useFormatter();
	const router = useRouter();
	const [loading, setLoading] = useState<PlanId | false>(false);

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

			const cardPrices = typedPlan.prices.filter(
				(price) => (price.paymentMethod ?? "card") === "card",
			);
			const weeklyPrice = cardPrices.find(
				(price): price is SubscriptionPlanPrice =>
					price.type === "subscription" && price.interval === "week",
			);
			const yearlyPrice = cardPrices.find(
				(price): price is SubscriptionPlanPrice =>
					price.type === "subscription" && price.interval === "year",
			);
			const price =
				cardPrices.find((price) => price.type === "one-time") ??
				weeklyPrice ??
				cardPrices[0];

			if (!price) {
				return [];
			}

			return [
				{
					id: visiblePlanId,
					title: planDataEntry.title,
					description: planDataEntry.description,
					features: planDataEntry.features,
					price,
					weeklyPrice,
					yearlyPrice,
					recommended: typedPlan.recommended,
					paymentMethods: getPaymentMethodsForPlan(),
				},
			];
		}),
	];

	if (displayPlans.length === 0) {
		return null;
	}

	return (
		<div className={cn("@container", className)}>
			<div
				className={cn(
					"gap-4 mx-auto grid grid-cols-1",
					displayPlans.length <= 2
						? "max-w-4xl md:grid-cols-2"
						: "max-w-6xl md:grid-cols-2 lg:grid-cols-3",
				)}
			>
				{displayPlans.map((plan) => {
					const hasBillingOptions =
						plan.id === "pro" && plan.weeklyPrice && plan.yearlyPrice;
					const yearlySavingsPercent = 86;
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

									{plan.price && !hasBillingOptions && (
										<div className="mt-2">
											<strong
												className="font-medium text-2xl block whitespace-nowrap"
												data-test="price-table-plan-price"
											>
												{format.number(plan.price.amount, {
													style: "currency",
													currency: "USD",
												})}
												{plan.price.type === "subscription" && (
													<span className="font-normal text-xs opacity-60">
														{" / "}
														{t("pricing.weekUnit")}
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

								<div className="gap-2 grid">
									{hasBillingOptions && plan.weeklyPrice && plan.yearlyPrice ? (
										[plan.yearlyPrice, plan.weeklyPrice].map((optionPrice) => {
											const billingInterval = optionPrice.interval;
											const isYearly = billingInterval === "year";
											const optionAmount = isYearly ? 49.99 : 6.99;

											return (
												<Button
													key={billingInterval}
													className={cn(
														"px-5 py-4 min-w-0 relative h-auto min-h-[104px] w-full items-stretch justify-start overflow-visible rounded-2xl border-2 text-left whitespace-normal",
														isYearly
															? "border-white bg-card text-foreground hover:bg-card"
															: "border-white/20 hover:bg-white/5 bg-card text-foreground",
													)}
													variant="secondary"
													onClick={() =>
														onSelectPlan(plan.id as PlanId, {
															type: "subscription",
															interval: billingInterval,
														})
													}
													loading={loading === plan.id}
												>
													<span className="gap-x-4 gap-y-2 relative grid min-h-[72px] w-full grid-cols-[minmax(0,1fr)_minmax(82px,auto)] grid-rows-[auto_1fr] items-center">
														{isYearly && (
															<span className="-top-3 bg-blue-600 px-3 py-1 text-xs font-medium text-white absolute left-1/2 -translate-x-1/2 rounded-full">
																{t("pricing.savePercent", {
																	percent: yearlySavingsPercent,
																})}
															</span>
														)}
														<span className="text-sm font-medium row-start-1 text-left">
															{isYearly
																? t("pricing.yearly")
																: t("pricing.weekly")}
														</span>
														<span className="gap-x-2 col-start-1 row-start-2 flex flex-wrap items-baseline text-left">
															<strong className="text-xl">
																{format.number(optionAmount, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
																})}
																u
															</strong>
															{isYearly && (
																<span className="text-sm line-through opacity-60">
																	{format.number(6.99 * 52, {
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	})}
																	u
																</span>
															)}
														</span>
														<span className="contents">
															<strong className="col-start-2 row-start-1 text-right">
																{format.number(
																	isYearly ? 49.99 / 52 : 6.99,
																	{
																		minimumFractionDigits: 2,
																		maximumFractionDigits: 2,
																	},
																)}
																u
															</strong>
															<span className="text-xs col-start-2 row-start-2 text-right opacity-70">
																{t("pricing.weekly")}
															</span>
														</span>
													</span>
												</Button>
											);
										})
									) : (
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
											{plan.price && (
												<ArrowRightIcon className="ml-2 size-4" />
											)}
										</Button>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
