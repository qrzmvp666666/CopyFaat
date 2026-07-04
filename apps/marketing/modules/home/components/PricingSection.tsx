"use client";

import { config } from "@config";
import { LocaleLink } from "@i18n/routing";
import { config as paymentsConfig } from "@repo/payments/config";
import type { PaidPlan } from "@repo/payments/types";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { AlipayIcon, StripeIcon, WeChatIcon } from "@repo/ui/components/payment-brand-icons";
import { RedeemCodePurchaseLink } from "@repo/ui/components/redeem-code-purchase-link";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { ArrowRightIcon, BadgePercentIcon, CheckIcon, GiftIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { ComponentType, SVGProps } from "react";
import { useMemo, useState } from "react";

const visiblePaidPlanIds = ["pro", "lifetime"] as const;

type VisiblePaidPlanId = (typeof visiblePaidPlanIds)[number];
type PaymentMethodMark = "card" | "alipay_person" | "wechat_person" | "redeem";

function isVisiblePaidPlanId(planId: string): planId is VisiblePaidPlanId {
	return visiblePaidPlanIds.includes(planId as VisiblePaidPlanId);
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

const MARKETING_PLAN_COPY = {
	zh: {
		free: {
			title: "免费",
			description: "前200名用户限时领取：注册成功后，即可领取 48 小时 Pro 会员",
			features: ["0 USD 免费体验", "注册成功即可领取 48 小时 Pro 会员"],
		},
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
		free: {
			title: "Free",
			description:
				"Limited offer for the first 200 users: sign up to claim 48 hours of Pro membership",
			features: ["0 USD free access", "Claim 48 hours of Pro after signup"],
		},
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
	const xianyuRedeemT = useTranslations("pricing.xianyuRedeem");
	const locale = useLocale();
	const [interval, setBillingInterval] = useState<"month" | "year">("month");

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
			priceLabel?: string;
			paymentMethods?: PaymentMethodMark[];
			to: string;
		}> = [];

		if (!paymentsConfig.requireActiveSubscription) {
			const freeCopy = marketingPlanCopy.free;
			result.push({
				id: "free",
				title: freeCopy.title,
				description: freeCopy.description,
				features: [...freeCopy.features],
				cta: t("pricing.getStarted") ?? "",
				priceLabel: t.raw("pricing.products.free.price") as string,
				to: saasUrl ? `${saasUrl}/signup` : "#",
			});
		}

		for (const [planId, plan] of Object.entries(paymentsConfig.plans)) {
			if (!isVisiblePaidPlanId(planId)) {
				continue;
			}

			const isEnterprise = "isEnterprise" in plan;
			if (isEnterprise) continue;
			const prices = "prices" in plan ? (plan as PaidPlan).prices : undefined;
			const price = prices?.find(
				(price) =>
					!plan.hidden &&
					(price.type === "one-time" || price.interval === interval) &&
					(price.paymentMethod ?? "card") === "card",
			);

			if (!price) {
				continue;
			}

			const copy =
				planId === "pro"
					? marketingPlanCopy.pro
					: planId === "lifetime"
						? marketingPlanCopy.lifetime
						: undefined;
			const rawPrice = t.raw(`pricing.products.${planId}.price`) as
				| string
				| Record<string, string>;
			const priceLabel = typeof rawPrice === "string" ? rawPrice : rawPrice[interval];

			// Point directly to /choose-plan on the saas app with planId+interval.
			// The saas app redirects to /login if not authenticated, preserving the query params.
			const planUrl = saasUrl
				? `${saasUrl}/choose-plan?planId=${planId}&interval=${interval}`
				: "#";

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
				priceLabel,
				paymentMethods: getPaymentMethodsForPlan(planId),
				to: isEnterprise ? (saasUrl ? `${saasUrl}/signup` : "#") : planUrl,
			});
		}

		return result;
	}, [t, saasUrl, interval, marketingPlanCopy]);

	const hasSubscriptions = Object.entries(paymentsConfig.plans).some(([planId, plan]) =>
		isVisiblePaidPlanId(planId) && "prices" in plan
			? (plan as PaidPlan).prices.some((price) => price.type === "subscription")
			: false,
	);

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
					{hasSubscriptions && (
						<div className="mb-6 flex justify-center">
							<Tabs
								value={interval}
								onValueChange={(value) =>
									setBillingInterval(value as "month" | "year")
								}
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
							plans.length <= 2 ? "max-w-4xl" : "max-w-7xl",
							plans.length >= 2 && "@xl:grid-cols-2",
							plans.length >= 3 && "@3xl:grid-cols-3",
							plans.length >= 4 && "@4xl:grid-cols-4",
						)}
					>
						{plans.map((plan) => {
							const isFree = !plan.prices;
							const price = isFree
								? undefined
								: plan.prices?.find(
										(p) =>
											(p.type === "one-time" || p.interval === interval) &&
											(p.paymentMethod ?? "card") === "card",
									);
							const trialPeriodDays =
								price && "trialPeriodDays" in price && price.trialPeriodDays
									? price.trialPeriodDays
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
												{price && plan.paymentMethods && (
													<PaymentMethodMarks
														methods={plan.paymentMethods}
													/>
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
											{price && !plan.priceLabel && (
												<strong
													className="font-medium text-2xl mt-2 block whitespace-nowrap"
													data-test="price-table-plan-price"
												>
													{price.amount} USDT
													{price.type === "subscription" && (
														<span className="font-normal text-xs opacity-60">
															/
															{price.interval === "year"
																? t("pricing.year", {
																		count: 1,
																	})
																: t("pricing.month", {
																		count: 1,
																	})}
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

											{isFree && (
												<div className="mt-4 flex justify-start">
													<Image
														src="/images/qq-qrcode.png"
														alt="QQ 二维码"
														width={140}
														height={140}
														className="size-[140px] rounded-lg object-contain"
													/>
												</div>
											)}
										</div>

										<div>
											{price && (
												<div className="mb-3">
													<RedeemCodePurchaseLink
														ariaLabel={xianyuRedeemT("ariaLabel")}
														copyErrorDescription={xianyuRedeemT(
															"copyErrorDescription",
														)}
														copyErrorTitle={xianyuRedeemT(
															"copyErrorTitle",
														)}
														copiedDescription={xianyuRedeemT(
															"copiedDescription",
														)}
														copiedTitle={xianyuRedeemT("copiedTitle")}
														label={xianyuRedeemT("label")}
														url={config.xianyuRedeemUrl}
													/>
												</div>
											)}
											{plan.to.startsWith("/") ? (
												<Button
													className="mt-4 w-full"
													variant={
														plan.recommended ? "primary" : "secondary"
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
														plan.recommended ? "primary" : "secondary"
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
