import { ContactChannels } from "@shared/components/ContactChannels";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	const t = await getTranslations({ locale, namespace: "contact" });
	return {
		title: t("title"),
	};
}

export default async function ContactPage(props: { params: Promise<{ locale: string }> }) {
	const { locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations({ locale, namespace: "contact" });
	return (
		<div className="max-w-4xl py-16 container">
			<div className="mb-12 pt-8 text-center">
				<h1 className="mb-2 font-bold text-5xl">{t("title")}</h1>
				<p className="text-lg text-balance text-muted-foreground">
					选择你习惯的方式找到我们。
				</p>
			</div>

			<ContactChannels />
		</div>
	);
}
