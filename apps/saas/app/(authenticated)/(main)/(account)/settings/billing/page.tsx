import { getSession } from "@auth/lib/server";
import { ActivePlan } from "@payments/components/ActivePlan";
import { ChangePlan } from "@payments/components/ChangePlan";
import { listPurchases } from "@payments/lib/server";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { PageHeader } from "@shared/components/PageHeader";
import { SettingsList } from "@shared/components/SettingsList";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations("settings.billing");

	return {
		title: t("title"),
	};
}

export default async function BillingSettingsPage() {
	const session = await getSession();
	const purchasesResult = await listPurchases();

	const queryClient = getServerQueryClient();

	await queryClient.prefetchQuery({
		queryKey: orpc.payments.listPurchases.queryKey({
			input: {},
		}),
		queryFn: () => purchasesResult,
	});

	const { activePlan } = createPurchasesHelper(
		purchasesResult.purchases,
		purchasesResult.entitlementGrants,
	);
	const showActivePlanInPricing =
		activePlan?.id === "pro" &&
		"source" in activePlan &&
		activePlan.source === "signup_trial";
	const t = await getTranslations("settings.billing");

	return (
		<>
			<PageHeader title={t("title")} subtitle={t("changePlan.description")} />

			<SettingsList>
				{activePlan && <ActivePlan showRedeemButton />}
				<ChangePlan
					userId={session?.user.id}
					activePlanId={activePlan?.id}
					showActivePlanInPricing={showActivePlanInPricing}
				/>
			</SettingsList>
		</>
	);
}
