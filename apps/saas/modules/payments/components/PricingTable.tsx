"use client";

import "@repo/ui/components/pricing/copyfast-pricing.css";
import { useSession } from "@auth/hooks/use-session";
import { useProCheckout } from "@payments/hooks/pro-checkout";
import { config as paymentsConfig } from "@repo/payments/config";
import { CopyFastPricing } from "@repo/ui/components/pricing/copyfast-pricing";
import { useLocale, useTranslations } from "next-intl";

import { PricingOffer } from "./PricingOffer";

interface PricingTableProps {
	className?: string;
	onCheckoutStarted?: () => void;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	showActivePlanInPricing?: boolean;
	planIds?: readonly string[];
	initialPeriod?: "year" | "week";
}

export function PricingTable({ className, onCheckoutStarted, initialPeriod }: PricingTableProps) {
	const { user } = useSession();
	const locale = useLocale();
	const t = useTranslations("pricingComparison");
	const checkout = useTranslations("signals.mobilePaywall");
	const {
		period,
		setPeriod,
		paymentMethod,
		setPaymentMethod,
		isStartingCheckout,
		startCheckout,
	} = useProCheckout({ initialPeriod, onCheckoutStarted, isAuthenticated: Boolean(user) });
	const plan = paymentsConfig.plans.pro;
	const price =
		"prices" in plan
			? plan.prices.find(
					(price) => price.type === "subscription" && price.interval === period,
				)
			: undefined;
	if (!price) return null;

	return (
		<div className={className}>
			<CopyFastPricing
				locale={locale}
				interval={period}
				onIntervalChange={setPeriod}
				price={price}
				t={t}
				periods={t.raw("periods") as string[]}
				alternativeHighlights={t.raw("alternativeHighlights") as string[]}
				planHighlights={t.raw("planHighlights") as string[]}
				actions={
					<>
						<div
							className="island-billing-switch"
							aria-label={`${checkout("stablecoin")} / ${checkout("card")}`}
						>
							{(["stablecoin", "card"] as const).map((method) => (
								<button
									key={method}
									type="button"
									aria-pressed={paymentMethod === method}
									onClick={() => setPaymentMethod(method)}
								>
									{checkout(method)}
								</button>
							))}
						</div>
						<PricingOffer />
						<button
							className="island-button island-button-primary"
							type="button"
							disabled={isStartingCheckout}
							onClick={startCheckout}
						>
							{checkout("unlock")}
						</button>
					</>
				}
			/>
		</div>
	);
}
