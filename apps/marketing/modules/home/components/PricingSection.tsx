"use client";

import { LocaleLink } from "@i18n/routing";
import { config as paymentsConfig } from "@repo/payments/config";
import { getSaasUrl } from "@shared/lib/saas-url";
import { CheckIcon, ArrowUpRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

export function PricingSection() {
	const t = useTranslations("home.island");
	const locale = useLocale();
	const [interval, setInterval] = useState<"year" | "week">("year");
	const plan = paymentsConfig.plans.pro;
	const price =
		"prices" in plan
			? plan.prices.find(
					(price) => price.type === "subscription" && price.interval === interval,
				)
			: undefined;
	if (!price) return null;
	const periods = t.raw("periods") as string[];
	const benefits = t.raw("benefits") as string[];
	return (
		<section id="pricing" className="island-pricing">
			<header className="island-section-heading">
				<h2>{t("pricingTitle")}</h2>
				<p>{t("pricingDescription")}</p>
			</header>
			<div className="island-pricing-card">
				<div className="island-pricing-scatter" aria-hidden="true" />
				<span className="island-plan-name">SignalFast Pro</span>
				<p className="island-plan-description">{t("planDescription")}</p>
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
				<div className="island-billing-switch" aria-label={t("plans")}>
					{(["year", "week"] as const).map((period, index) => (
						<button
							type="button"
							key={period}
							aria-pressed={interval === period}
							onClick={() => setInterval(period)}
						>
							{periods[index]}
						</button>
					))}
				</div>
				<p className="island-billing-note">{t("billing")}</p>
				<ul>
					{benefits.map((benefit) => (
						<li key={benefit}>
							<CheckIcon size={15} aria-hidden="true" />
							{benefit}
						</li>
					))}
				</ul>
				<a
					className="island-button island-button-primary"
					href={getSaasUrl(locale, `/choose-plan?planId=pro&interval=${interval}`)}
				>
					{t("subscribe")}
					<ArrowUpRightIcon size={15} />
				</a>
			</div>
			<p className="island-pricing-contact">
				{t("questions")} <LocaleLink href="/contact">{t("contact")} ↗</LocaleLink>
			</p>
		</section>
	);
}
