import { SourceBindingsAdmin } from "@admin/component/source-bindings/SourceBindingsAdmin";
import { getTranslations } from "next-intl/server";
export async function generateMetadata() {
	const t = await getTranslations("admin.sourceBindings");
	return { title: t("title") };
}
export default function AdminSourceBindingsPage() {
	return <SourceBindingsAdmin />;
}
