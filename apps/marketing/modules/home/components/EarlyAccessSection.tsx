import { config } from "@config";
import { Button } from "@repo/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export function EarlyAccessSection() {
	const t = useTranslations();
	const locale = useLocale();

	return (
		<section className="py-8 md:block lg:py-12 hidden">
			<div className="container">
				<div className="max-w-4xl px-8 py-10 shadow-sm md:px-14 md:py-12 mx-auto rounded-2xl border bg-card text-center">
					<h2 className="font-bold text-2xl leading-snug md:text-3xl text-balance text-foreground">
						{t("home.earlyAccess.title")}
					</h2>

					<p className="mt-3 max-w-xl text-sm md:text-base mx-auto text-muted-foreground">
						{t("home.earlyAccess.subtitle")}
					</p>

					<div className="mt-6 gap-2 flex items-center justify-center">
						{config.saasUrl && (
							<Button size="lg" variant="primary" asChild>
								<a href={`${config.saasUrl.replace(/\/$/, "")}/${locale}`}>
									{t("home.earlyAccess.getStarted")}
									<ArrowRightIcon className="ml-2 size-4" />
								</a>
							</Button>
						)}
						{config.docsUrl && (
							<Button variant="ghost" size="lg" asChild>
								<a href={config.docsUrl}>{t("home.earlyAccess.readDocs")}</a>
							</Button>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
