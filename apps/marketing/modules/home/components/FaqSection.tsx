import { LocaleLink } from "@i18n/routing";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function FaqSection() {
	const t = useTranslations("home.island");
	const items = t.raw("faq") as [string, string][];
	return (
		<section id="faq" className="island-faq">
			<h2>{t("faqTitle")}</h2>
			<div>
				{items.map(([question, answer], index) => (
					<details key={question}>
						<summary>
							{question}
							<PlusIcon size={16} aria-hidden="true" />
						</summary>
						<p>
							{answer}
							{index === items.length - 1 && (
								<>
									{" "}
									<LocaleLink href="/contact">{t("contact")} →</LocaleLink>
								</>
							)}
						</p>
					</details>
				))}
			</div>
		</section>
	);
}
