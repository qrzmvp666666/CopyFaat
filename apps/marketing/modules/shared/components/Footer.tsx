import { LocaleLink } from "@i18n/routing";
import { Logo } from "@shared/components/Logo";
import { useTranslations } from "next-intl";

export function Footer() {
	const t = useTranslations("home.island");
	return (
		<footer className="island-footer island-width">
			<div className="island-footer-grid">
				<div>
					<LocaleLink href="/" className="island-brand island-footer-brand">
						<Logo />
					</LocaleLink>
					<p>{t("footerDescription")}</p>
				</div>
				<div>
					<h3>{t("product")}</h3>
					<LocaleLink href="/#features">{t("featuresLabel")}</LocaleLink>
					<LocaleLink href="/#pricing">{t("plans")}</LocaleLink>
					<LocaleLink href="/#faq">{t("faqTitle")}</LocaleLink>
				</div>
				<div>
					<h3>{t("resources")}</h3>
					<LocaleLink href="/blog">{t("blog")}</LocaleLink>
					<LocaleLink href="/contact">{t("contact")}</LocaleLink>
				</div>
				<div>
					<h3>{t("legal")}</h3>
					<LocaleLink href="/legal/privacy-policy">{t("privacy")}</LocaleLink>
					<LocaleLink href="/legal/terms">{t("terms")}</LocaleLink>
				</div>
				<div>
					<h3>{t("friendLinks")}</h3>
					<a href="https://www.signalfast.cn/" target="_blank" rel="noopener noreferrer">
						signalfast
					</a>
				</div>
			</div>
			<div className="island-footer-bottom">
				<span>
					© {new Date().getFullYear()} CopyFast. {t("rights")}
				</span>
				<span>Discord</span>
			</div>
		</footer>
	);
}
