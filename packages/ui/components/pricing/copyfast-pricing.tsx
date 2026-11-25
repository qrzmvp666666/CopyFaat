"use client";

import { CheckIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

export type PricingLabel =
	| "pricingTitle"
	| "pricingDescription"
	| "estimatedSavings"
	| "estimatedExtraCost"
	| "alternativeTitle"
	| "costDescription"
	| "accountCost"
	| "perYear"
	| "perMonth"
	| "aiCost"
	| "alternativeTotal"
	| "ourPlanTitle"
	| "planDescription"
	| "plans"
	| "costFootnote"
	| "perWeek";

interface CopyFastPricingProps {
	locale: string;
	interval: "year" | "week";
	onIntervalChange: (period: "year" | "week") => void;
	price: { amount: number; currency: string };
	t: (key: PricingLabel, values?: Record<string, string | number>) => string;
	periods: string[];
	alternativeHighlights: string[];
	planHighlights: string[];
	actions: ReactNode;
	footer?: ReactNode;
}

export function CopyFastPricing({
	locale,
	interval,
	onIntervalChange,
	price,
	t,
	periods,
	alternativeHighlights,
	planHighlights,
	actions,
	footer,
}: CopyFastPricingProps) {
	const alternativeMonthlyCost = 2 * 20 + 20;
	const alternativeAnnualCost = alternativeMonthlyCost * 12;
	const copyFastAnnualCost = interval === "year" ? price.amount : price.amount * 52;
	const estimatedAnnualSavings = alternativeAnnualCost - copyFastAnnualCost;
	const formatCurrency = (amount: number) =>
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency: price.currency,
			currencyDisplay: "narrowSymbol",
			minimumFractionDigits: 2,
		}).format(amount);
	return (
		<section id="pricing" className="copyfast-pricing island-pricing">
			<header className="island-section-heading">
				<h2>{t("pricingTitle")}</h2>
				<p>{t("pricingDescription")}</p>
			</header>
			<div className="island-cost-value">
				<p className="island-cost-savings" aria-live="polite">
					{estimatedAnnualSavings >= 0
						? t("estimatedSavings", {
								amount: formatCurrency(estimatedAnnualSavings),
							})
						: t("estimatedExtraCost", {
								amount: formatCurrency(Math.abs(estimatedAnnualSavings)),
							})}
				</p>
				<div className="island-cost-comparison">
					<div className="island-cost-side island-cost-alternative">
						<p className="island-cost-eyebrow">{t("alternativeTitle")}</p>
						<p className="island-cost-description">{t("costDescription")}</p>
						<div className="island-cost-equation">
							<div>
								<span>{t("accountCost")}</span>
								<strong>
									{formatCurrency(2 * 20 * 12)}
									{t("perYear")}
								</strong>
								<small>
									{formatCurrency(2 * 20)}
									{t("perMonth")}
								</small>
							</div>
							<span className="island-cost-operator" aria-hidden="true">
								+
							</span>
							<div>
								<span>{t("aiCost")}</span>
								<strong>
									{formatCurrency(20 * 12)}
									{t("perYear")}
								</strong>
								<small>
									{formatCurrency(20)}
									{t("perMonth")}
								</small>
							</div>
							<span className="island-cost-operator" aria-hidden="true">
								=
							</span>
							<div className="island-cost-equation-total">
								<span>{t("alternativeTotal")}</span>
								<strong>
									{formatCurrency(alternativeAnnualCost)}
									{t("perYear")}
								</strong>
								<small>
									{formatCurrency(alternativeMonthlyCost)}
									{t("perMonth")}
								</small>
							</div>
						</div>
						<ul className="island-cost-benefits island-cost-limitations">
							{alternativeHighlights.map((highlight) => (
								<li key={highlight}>
									<XIcon size={16} aria-hidden="true" />
									<span>{highlight}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="island-cost-versus" aria-hidden="true">
						VS
					</div>
					<div className="island-cost-side island-cost-copyfast">
						<p className="island-cost-eyebrow">{t("ourPlanTitle")}</p>
						<p className="island-cost-description">{t("planDescription")}</p>
						<div className="island-price-row">
							<div className="island-price" aria-live="polite">
								<strong>
									{new Intl.NumberFormat(locale, {
										style: "currency",
										currency: price.currency,
										currencyDisplay: "narrowSymbol",
									}).format(price.amount)}
								</strong>
								<span>{t(interval === "year" ? "perYear" : "perWeek")}</span>
							</div>
							<div
								className="island-payment-methods"
								aria-label="Visa, Mastercard, USDT on TRON"
							>
								<span className="island-payment-visa" aria-hidden="true">
									VISA
								</span>
								<span className="island-payment-mastercard" aria-hidden="true">
									<i />
									<i />
								</span>
								<span className="island-payment-usdt" aria-label="USDT Tether">
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<circle cx="12" cy="12" r="10" />
										<path d="M6 7h12M12 7v10m-5-6c1.4.8 8.6.8 10 0M7 11v2c1.4.9 8.6.9 10 0v-2" />
									</svg>
									USDT
								</span>
								<span className="island-payment-tron" aria-label="TRON">
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="M3 3 21 7 12 21 3 3Zm0 0 8 4 10 0M11 7l1 14M11 7l10 0" />
									</svg>
								</span>
							</div>
						</div>
						<div className="island-billing-switch" aria-label={t("plans")}>
							{(["year", "week"] as const).map((period, index) => (
								<button
									type="button"
									key={period}
									aria-pressed={interval === period}
									onClick={() => onIntervalChange(period)}
								>
									{periods[index]}
								</button>
							))}
						</div>
						<ul className="island-cost-benefits">
							{planHighlights.map((highlight) => (
								<li key={highlight}>
									<CheckIcon size={16} aria-hidden="true" />
									<span>{highlight}</span>
								</li>
							))}
						</ul>
						{actions}
					</div>
					<p className="island-cost-footnote">
						{t("costFootnote", {
							annualCost: formatCurrency(alternativeAnnualCost),
						})}
					</p>
				</div>
			</div>
			{footer}
		</section>
	);
}
