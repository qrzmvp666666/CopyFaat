import { getOrganizationList, getSession } from "@auth/lib/server";
import { redirectWithLocale } from "@i18n/redirect";
import { localizePath } from "@i18n/routing";
import { PricingTable } from "@payments/components/PricingTable";
import { listPurchases } from "@payments/lib/server";
import { config as authConfig } from "@repo/auth/config";
import type { Locale } from "@repo/i18n";
import { config as paymentsConfig } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { AuthWrapper } from "@shared/components/AuthWrapper";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations("choosePlan");

	return {
		title: t("title"),
	};
}

export default async function ChoosePlanPage({
	searchParams,
}: {
	searchParams: Promise<{ planId?: string; interval?: string; paymentMethod?: string }>;
}) {
	const t = await getTranslations("choosePlan");
	const locale = (await getLocale()) as Locale;
	const { planId, interval } = await searchParams;
	const session = await getSession();

	if (!session) {
		const loginPath = planId
			? `/login?redirectTo=${encodeURIComponent(`/choose-plan?planId=${planId}${interval ? `&interval=${interval}` : ""}`)}`
			: "/login";
		redirect(localizePath(loginPath, locale));
	}

	let organizationId: string | undefined;
	if (authConfig.organizations.enable && paymentsConfig.billingAttachedTo === "organization") {
		const organization = (await getOrganizationList()).at(0);

		if (!organization) {
			return await redirectWithLocale("/new-organization");
		}

		organizationId = organization.id;
	}

	const purchasesResult = await listPurchases(organizationId);

	const { activePlan } = createPurchasesHelper(
		purchasesResult.purchases,
		purchasesResult.entitlementGrants,
	);

	if (activePlan && activePlan.id !== "free") {
		return await redirectWithLocale("/");
	}

	return (
		<AuthWrapper contentClass="max-w-5xl">
			<div className="mb-4 text-center">
				<h1 className="font-bold text-2xl lg:text-3xl text-center">{t("title")}</h1>
				<p className="text-sm lg:text-base text-muted-foreground">{t("description")}</p>
			</div>

			<div>
				<PricingTable
					initialPeriod={interval === "week" ? "week" : "year"}
					{...(organizationId
						? {
								organizationId,
							}
						: {
								userId: session.user.id,
							})}
				/>
			</div>
		</AuthWrapper>
	);
}
