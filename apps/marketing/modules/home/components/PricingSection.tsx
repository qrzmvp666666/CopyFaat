"use client";

import { config } from "@config";
import { LocaleLink } from "@i18n/routing";
import { config as paymentsConfig } from "@repo/payments/config";
import type { PaidPlan } from "@repo/payments/types";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	ArrowRightIcon,
	BadgePercentIcon,
	CheckIcon,
	CreditCardIcon,
	StarIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";

import tetherTokenLogo from "../../../public/images/tether-usdt.png";

const visiblePaidPlanIds = ["pro"] as const;

type VisiblePaidPlanId = (typeof visiblePaidPlanIds)[number];
type PaymentMethodMark = "card" | "crypto";
type SubscriptionPlanPrice = Extract<PaidPlan["prices"][number], { type: "subscription" }>;

function isVisiblePaidPlanId(planId: string): planId is VisiblePaidPlanId {
	return visiblePaidPlanIds.includes(planId as VisiblePaidPlanId);
}

function getPaymentMethodsForPlan(): PaymentMethodMark[] {
	return ["card", "crypto"];
}

function PaymentMethodMarks({ methods, locale }: { methods: PaymentMethodMark[]; locale: string }) {
	const paymentMethods: Record<
		PaymentMethodMark,
		{
			label: string;
			icon: ComponentType<{ className?: string }>;
			className: string;
		}
	> = {
		card: {
			label: locale === "zh" ? "信用卡支付" : "Card payments",
			icon: CreditCardIcon,
			className: "size-5 text-foreground/70",
		},
		crypto: {
			label: locale === "zh" ? "加密支付" : "Pay Crypto",
			icon: TetherTokenIcon,
			className: "size-5",
		},
	};

	return (
		<div
			className="gap-2 flex shrink-0 items-center"
			role="group"
			aria-label={locale === "zh" ? "支持的支付方式" : "Accepted payment methods"}
		>
			{methods.map((method) => {
				const paymentMethod = paymentMethods[method];
				const Icon = paymentMethod.icon;

				return (
					<span
						key={method}
						className="gap-1.5 px-2 py-1 inline-flex items-center rounded-full border border-foreground/10"
						title={paymentMethod.label}
						role="img"
						aria-label={paymentMethod.label}
					>
						<Icon className={paymentMethod.className} aria-hidden="true" />
					</span>
				);
			})}
		</div>
	);
}

function TetherTokenIcon({ className }: { className?: string }) {
	return <Image src={tetherTokenLogo} alt="" width={32} height={32} className={className} />;
}

const MARKETING_PLAN_COPY = {
	zh: {
		pro: {
			title: "Pro",
			description: "适合需要实时行情、KOL 信号和专属支持的加密交易用户",
			features: [
				"无广告体验",
				"币圈实时市场报价",
				"KOL 聚合 K线跟踪",
				"KOL 实时信号推送",
				"专属客服支持",
				"专属社区通知",
			],
		},
		lifetime: {
			title: "终身版",
			description: "适合长期使用 SignalFast 的用户，一次付费锁定核心权益。",
			features: [
				"包含 Pro 所有功能",
				"一次付费，无二次收费",
				"后续新功能优先免费使用",
				"邮箱提醒优先免费使用",
				"Telegram 提醒优先免费使用",
				"Discord 提醒优先免费使用",
			],
		},
	},
	en: {
		pro: {
			title: "Pro",
			description:
				"For crypto traders who need real-time market data, KOL signals, and dedicated support",
			features: [
				"Ad-free experience",
				"Real-time crypto market quotes",
				"Aggregated KOL K-line tracking",
				"Real-time KOL signal pushes",
				"Dedicated support",
				"Exclusive community notifications",
			],
		},
		lifetime: {
			title: "Lifetime",
			description: "For long-term SignalFast users who want to lock in core access once.",
			features: [
				"All Pro features included",
				"One-time payment, no hidden fees",
				"Priority free access to future features",
				"Priority free email alerts",
				"Priority free Telegram alerts",
				"Priority free Discord alerts",
			],
		},
	},
} as const;

export function PricingSection() {
	const t = useTranslations();
	const format = useFormatter();
	const locale = useLocale();
	const [selectedInterval, setSelectedInterval] = useState<"year" | "week">("year");
	const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodMark>("card");

	const saasUrl = useMemo(
		() => config.saasUrl && `${String(config.saasUrl).replace(/\/$/, "")}`,
		[],
	);
	const marketingPlanCopy =
		MARKETING_PLAN_COPY[locale as keyof typeof MARKETING_PLAN_COPY] ?? MARKETING_PLAN_COPY.en;

	const plans = useMemo(() => {
		const result: Array<{
			id: string;
			title: string;
			description: string;
			features: string[];
			cta: string;
			recommended?: boolean;
			prices?: PaidPlan["prices"];
			price?: PaidPlan["prices"][number];
			paymentMethods?: PaymentMethodMark[];
			to: string;
		}> = [];

		for (const [planId, plan] of Object.entries(paymentsConfig.plans)) {
			if (!isVisiblePaidPlanId(planId)) {
				continue;
			}

			const isEnterprise = "isEnterprise" in plan;
			if (isEnterprise) continue;
			if (plan.hidden) continue;

			const prices = (plan as PaidPlan).prices.filter(
				(price) => (price.paymentMethod ?? "card") === "card",
			);
			const price =
				prices.find((price) => price.type === "one-time") ??
				prices.find(
					(price) => price.type === "subscription" && price.interval === "week",
				) ??
				prices[0];

			if (!price) {
				continue;
			}

			const copy =
				planId === "pro"
					? marketingPlanCopy.pro
					: planId === "lifetime"
						? marketingPlanCopy.lifetime
						: undefined;
			const planUrl = saasUrl ? `${saasUrl}/choose-plan?planId=${planId}` : "#";

			result.push({
				id: planId,
				title: copy?.title ?? t(`pricing.products.${planId}.title`) ?? "",
				description: copy?.description ?? t(`pricing.products.${planId}.description`) ?? "",
				features:
					(copy?.features ? [...copy.features] : undefined) ??
					Object.values(
						(t.raw(`pricing.products.${planId}.features`) as Record<string, string>) ??
							{},
					),
				cta: t("pricing.getStarted") ?? "",
				recommended: plan.recommended,
				prices,
				price,
				paymentMethods: getPaymentMethodsForPlan(),
				to: isEnterprise ? (saasUrl ? `${saasUrl}/signup` : "#") : planUrl,
			});
		}

		return result;
	}, [t, saasUrl, marketingPlanCopy]);

	return (
		<section id="pricing" className="scroll-mt-16 pt-6 pb-10 lg:pt-8 lg:pb-14">
			<div className="container">
				<div className="mb-6 max-w-3xl mx-auto text-center">
					<h1 className="font-medium text-2xl md:text-3xl lg:text-4xl xl:text-5xl leading-tight text-foreground">
						{t("pricing.title")}
					</h1>
					<p className="mt-2 text-sm sm:text-lg text-foreground/60">
						{t("pricing.description")}
					</p>
				</div>

				<div className="@container">
					<div
						className={cn(
							"gap-4 mx-auto grid grid-cols-1",
							plans.length > 1 ? "max-w-4xl @xl:grid-cols-2" : "max-w-2xl",
						)}
					>
						{plans.map((plan) => {
							const weeklyPrice = plan.prices?.find(
								(price): price is SubscriptionPlanPrice =>
									price.type === "subscription" && price.interval === "week",
							);
							const yearlyPrice = plan.prices?.find(
								(price): price is SubscriptionPlanPrice =>
									price.type === "subscription" && price.interval === "year",
							);
							const hasBillingOptions =
								plan.id === "pro" && weeklyPrice && yearlyPrice;
							const yearlySavingsPercent = 86;
							const trialPeriodDays =
								plan.price &&
								"trialPeriodDays" in plan.price &&
								plan.price.trialPeriodDays
									? plan.price.trialPeriodDays
									: undefined;

							return (
								<div
									key={plan.id}
									className={cn(
										"p-6 relative rounded-3xl border bg-card",
										plan.recommended ? "border-primary" : "border-primary/20",
									)}
									data-test="price-table-plan"
								>
									{plan.recommended && (
										<div className="-top-3.5 px-3 py-1 font-semibold text-xs shadow-sm border-white bg-white text-black absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border text-center">
											<StarIcon className="mr-1.5 size-3.5 inline-block" />
											{t("pricing.recommended")}
										</div>
									)}
									<div className="gap-4 flex h-full flex-col justify-between">
										<div>
											<div className="gap-3 flex items-start justify-between">
												<h3 className="my-0 font-semibold text-2xl">
													{plan.title}
												</h3>
												{plan.price && plan.paymentMethods && (
													<PaymentMethodMarks
														methods={plan.paymentMethods}
														locale={locale}
													/>
												)}
											</div>
											{plan.price && !hasBillingOptions && (
												<strong
													className="font-medium text-2xl mt-2 block whitespace-nowrap"
													data-test="price-table-plan-price"
												>
													{format.number(plan.price.amount, {
														style: "currency",
														currency: "USD",
													})}
													{plan.price.type === "subscription" && (
														<span className="font-normal text-xs opacity-60">
															/
															{plan.price.interval === "year"
																? t("pricing.yearUnit")
																: t("pricing.weekUnit")}
														</span>
													)}
												</strong>
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

											{trialPeriodDays !== undefined &&
												trialPeriodDays > 0 && (
													<div className="mt-4 font-medium text-sm flex items-center justify-start text-primary opacity-80">
														<BadgePercentIcon className="mr-2 size-4" />
														{t("pricing.trialPeriod", {
															days: trialPeriodDays,
														})}
													</div>
												)}
											{hasBillingOptions && (
												<div className="mt-5 gap-2 grid">
													{[yearlyPrice, weeklyPrice].map(
														(optionPrice) => {
															if (!optionPrice) return null;

															const billingInterval =
																optionPrice.interval;
															const optionAmount =
																billingInterval === "year"
																	? 49.99
																	: 6.99;
															const isYearly =
																billingInterval === "year";
															const isSelected =
																selectedInterval ===
																billingInterval;

															return (
																<button
																	key={billingInterval}
																	type="button"
																	aria-pressed={isSelected}
																	onClick={() =>
																		setSelectedInterval(
																			billingInterval,
																		)
																	}
																	className={cn(
																		"px-5 py-4 min-w-0 focus-visible:ring-white/70 relative flex h-auto min-h-[104px] w-full items-stretch justify-start overflow-visible rounded-2xl border-2 text-left whitespace-normal transition-colors focus-visible:ring-2 focus-visible:outline-none",
																		isSelected
																			? "border-white bg-card text-foreground"
																			: "border-white/20 hover:border-white/45 hover:bg-white/5 bg-card text-foreground",
																	)}
																>
																	<span className="gap-x-4 gap-y-2 min-w-0 grid min-h-[72px] w-full grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center">
																		<span className="min-w-0 text-sm font-medium row-start-1 text-left">
																			{isYearly
																				? t(
																						"pricing.yearly",
																					)
																				: t(
																						"pricing.weekly",
																					)}
																		</span>
																		<span className="col-start-2 row-start-1 flex justify-end">
																			{isYearly &&
																			yearlySavingsPercent ? (
																				<span className="bg-blue-600 px-3 py-1 text-xs font-medium text-white top-0 absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full">
																					{t(
																						"pricing.savePercent",
																						{
																							percent:
																								yearlySavingsPercent,
																						},
																					)}
																				</span>
																			) : null}
																		</span>
																		<span className="contents">
																			<strong className="text-xl col-start-1 row-start-2">
																				{format.number(
																					optionAmount,
																					{
																						minimumFractionDigits: 2,
																						maximumFractionDigits: 2,
																					},
																				)}
																				u
																				{billingInterval ===
																					"year" && (
																					<span className="ml-2 text-sm font-normal line-through opacity-60">
																						{format.number(
																							6.99 *
																								52,
																							{
																								minimumFractionDigits: 2,
																								maximumFractionDigits: 2,
																							},
																						)}
																						u
																					</span>
																				)}
																			</strong>
																			<span className="contents">
																				<strong className="text-base col-start-2 row-start-1 text-right">
																					{format.number(
																						billingInterval ===
																							"year"
																							? 49.99 /
																									52
																							: 6.99,
																						{
																							minimumFractionDigits: 2,
																							maximumFractionDigits: 2,
																						},
																					)}
																					u
																				</strong>
																				<span className="text-xs col-start-2 row-start-2 text-right opacity-70">
																					{t(
																						"pricing.weekly",
																					)}
																				</span>
																			</span>
																		</span>
																	</span>
																</button>
															);
														},
													)}
												</div>
											)}
											{hasBillingOptions && (
												<div className="mt-4 gap-3 grid grid-cols-2">
													<button
														type="button"
														aria-pressed={
															selectedPaymentMethod === "card"
														}
														onClick={() =>
															setSelectedPaymentMethod("card")
														}
														className={cn(
															"px-4 py-3 min-h-14 gap-2.5 text-sm font-semibold focus-visible:ring-white/70 flex items-center justify-center rounded-xl border transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
															selectedPaymentMethod === "card"
																? "border-white bg-white text-black hover:bg-white/90"
																: "border-white/25 bg-white/[0.04] hover:border-white/45 hover:bg-white/[0.08] text-foreground",
														)}
													>
														<CreditCardIcon
															className="size-5"
															aria-hidden="true"
														/>
														{locale === "zh"
															? "信用卡支付"
															: "Pay by card"}
													</button>
													<button
														type="button"
														aria-pressed={
															selectedPaymentMethod === "crypto"
														}
														onClick={() =>
															setSelectedPaymentMethod("crypto")
														}
														className={cn(
															"px-4 py-3 min-h-14 gap-2.5 text-sm font-semibold focus-visible:ring-white/70 flex items-center justify-center rounded-xl border transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:outline-none active:scale-[0.98]",
															selectedPaymentMethod === "crypto"
																? "border-white bg-white text-black hover:bg-white/90"
																: "border-white/25 bg-white/[0.04] hover:border-white/45 hover:bg-white/[0.08] text-foreground",
														)}
													>
														<TetherTokenIcon className="size-5" />
														{locale === "zh"
															? "加密支付"
															: "Pay Crypto"}
													</button>
												</div>
											)}
										</div>

										{!hasBillingOptions && (
											<div>
												{plan.to.startsWith("/") ? (
													<Button
														className="mt-4 w-full"
														variant={
															plan.recommended
																? "primary"
																: "secondary"
														}
														asChild
													>
														<LocaleLink href={plan.to}>
															{plan.cta}
															<ArrowRightIcon className="ml-2 size-4" />
														</LocaleLink>
													</Button>
												) : (
													<Button
														className="mt-4 w-full"
														variant={
															plan.recommended
																? "primary"
																: "secondary"
														}
														asChild
													>
														<a href={plan.to}>
															{plan.cta}
															<ArrowRightIcon className="ml-2 size-4" />
														</a>
													</Button>
												)}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</section>
	);
}
