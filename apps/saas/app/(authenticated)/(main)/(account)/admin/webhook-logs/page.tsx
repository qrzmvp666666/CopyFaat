import { WebhookLogAdmin } from "@admin/component/webhook-logs/WebhookLogAdmin";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations("admin.webhookLogs");
	return { title: t("title") };
}

export default function AdminWebhookLogsPage() {
	return <WebhookLogAdmin />;
}
