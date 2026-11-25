"use client";

import "@repo/ui/components/pricing/copyfast-pricing.css";
import { LocaleLink } from "@i18n/routing";
import { config as paymentsConfig } from "@repo/payments/config";
import { CopyFastPricing } from "@repo/ui/components/pricing/copyfast-pricing";
import { ArrowUpRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

export function PricingSection() {
	const t = useTranslations("pricingComparison");
	const contact = useTranslations("home.island");
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
	const alternativeHighlights = t.raw("alternativeHighlights") as string[];
	const planHighlights = t.raw("planHighlights") as string[];
	return (
		<CopyFastPricing
			locale={locale}
			interval={interval}
			onIntervalChange={setInterval}
			price={price}
			t={t}
			periods={periods}
			alternativeHighlights={alternativeHighlights}
			planHighlights={planHighlights}
			actions={
				<LocaleLink className="island-button island-button-primary" href="/contact">
					{contact("subscribe")}
					<ArrowUpRightIcon size={15} />
				</LocaleLink>
			}
			footer={
				<p className="island-pricing-contact">
					{contact("questions")}{" "}
					<LocaleLink href="/contact">{contact("contact")} ↗</LocaleLink>
				</p>
			}
		/>
	);
}
