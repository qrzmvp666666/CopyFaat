"use client";

import { config } from "@config";
import { LocaleLink } from "@i18n/routing";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import { getSaasUrl } from "@shared/lib/saas-url";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

export function NavBar() {
	const t = useTranslations("home.island");
	const locale = useLocale();
	const pathname = usePathname();
	const isBlog = /^\/(zh|en)\/blog(?:\/|$)/.test(pathname);
	return (
		<nav className="island-nav" aria-label={t("navigation")} data-test="navigation">
			<div className="island-nav-inner">
				<LocaleLink href="/" className="island-brand">
					<Image src="/images/brand/copyfast-logo.svg" alt="" width={27} height={27} />
					<span>COPYFAST</span>
				</LocaleLink>
				<div className="island-nav-links">
					<a className="island-nav-text" href={`/${locale}#pricing`}>
						{t("pricing")}
					</a>
					<LocaleLink className="island-nav-text" href="/contact">
						{t("contact")}
					</LocaleLink>
					{config.docsUrl && (
						<a
							className="island-nav-text"
							href={config.docsUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							{t("docs")}
						</a>
					)}
					<LocaleLink
						href="/blog"
						className="island-nav-text island-nav-blog"
						aria-current={isBlog ? "page" : undefined}
					>
						{t("blog")}
					</LocaleLink>
					<Suspense>
						<LocaleSwitch />
					</Suspense>
					<a className="island-nav-cta" href={getSaasUrl(locale, "/login")}>
						{t("loginRegister")}
					</a>
				</div>
			</div>
		</nav>
	);
}
