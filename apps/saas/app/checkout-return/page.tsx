import { getSession } from "@auth/lib/server";
import { CheckoutReturnContent } from "@payments/components/CheckoutReturnContent";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { PartyPopperIcon } from "lucide-react";
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
		<AuthWrapper unframed={!session} contentClass={session ? undefined : "max-w-lg"}>
			{session ? (
				<div className="mb-4 text-center">
					<h1 className="font-bold text-2xl lg:text-3xl">{t("title")}</h1>
					<p className="text-sm lg:text-base text-muted-foreground">{t("description")}</p>
				</div>
			) : (
				<div className="-translate-y-2 gap-6 mb-2 flex flex-col items-center text-center">
					<div className="gap-2 flex flex-col">
						<div className="gap-2 text-sm font-medium flex items-center justify-center text-muted-foreground">
							<PartyPopperIcon className="size-4" aria-hidden="true" />
							<span>{t("successLabel")}</span>
						</div>
						<h1 className="font-bold text-3xl lg:text-4xl">{t("anonymousTitle")}</h1>
						<p className="max-w-sm text-sm leading-6 whitespace-pre-line text-muted-foreground">
							{t("anonymousDescription")}
						</p>
					</div>
				</div>
			)}

			<CheckoutReturnContent
				isAuthenticated={Boolean(session)}
				organizationId={params.organizationId}
				sessionId={params.session_id}
			/>
		</AuthWrapper>
	);
}
