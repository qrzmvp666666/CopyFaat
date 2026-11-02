import { getSession } from "@auth/lib/server";
import { CheckoutReturnContent } from "@payments/components/CheckoutReturnContent";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations("checkoutReturn");

	return {
		title: t("title"),
	};
}

export default async function CheckoutReturnPage({
	searchParams,
}: {
	searchParams: Promise<{
		organizationId?: string;
		session_id?: string;
	}>;
}) {
	const [session, t, params] = await Promise.all([
		getSession(),
		getTranslations("checkoutReturn"),
		searchParams,
	]);

	return (
		<AuthWrapper>
			<div className="mb-4 text-center">
				<h1 className="font-bold text-2xl lg:text-3xl">
					{session ? t("title") : t("anonymousTitle")}
				</h1>
				<p className="text-sm lg:text-base text-muted-foreground">
					{session ? t("description") : t("anonymousDescription")}
				</p>
			</div>

			<CheckoutReturnContent
				isAuthenticated={Boolean(session)}
				organizationId={params.organizationId}
				sessionId={params.session_id}
			/>
		</AuthWrapper>
	);
}
