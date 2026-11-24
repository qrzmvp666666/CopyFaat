"use client";

import { LocaleLink } from "@i18n/routing";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import { getSaasUrl } from "@shared/lib/saas-url";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Suspense } from "react";

export function NavBar() {
	const t = useTranslations("home.island");
	const locale = useLocale();
	return (
		<nav className="island-nav" aria-label={t("navigation")} data-test="navigation">
			<div className="island-nav-inner">
				<LocaleLink href="/" className="island-brand">
					<Image
						src="/images/brand/signalfast-logo-mark.png"
						alt=""
						width={27}
						height={27}
					/>
					<span>SIGNALFAST</span>
				</LocaleLink>
				<div className="island-nav-links">
					<LocaleLink className="island-nav-text" href="/blog">
						{t("blog")}
					</LocaleLink>
					<LocaleLink className="island-nav-text" href="/changelog">
						{t("changelog")}
					</LocaleLink>
					<Suspense>
						<LocaleSwitch />
					</Suspense>
					<a className="island-nav-cta" href={getSaasUrl(locale, "/install")}>
						{t("start")}
					</a>
				</div>
			</div>
		</nav>
	);
}
