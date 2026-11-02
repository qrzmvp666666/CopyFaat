"use client";

import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { Button } from "@repo/ui/components/button";
import { Spinner } from "@repo/ui/components/spinner";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MAX_WAIT_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;

interface CheckoutReturnContentProps {
	isAuthenticated: boolean;
	organizationId?: string;
	sessionId?: string;
}

export function CheckoutReturnContent({
	isAuthenticated,
	organizationId,
	sessionId,
}: CheckoutReturnContentProps) {
	const t = useTranslations("checkoutReturn");
	const router = useRouter();
	const [polling, setPolling] = useState(true);

	const returnParams = new URLSearchParams();
	if (organizationId) {
		returnParams.set("organizationId", organizationId);
	}
	if (sessionId) {
		returnParams.set("session_id", sessionId);
	}
	const returnPath = returnParams.toString()
		? `/checkout-return?${returnParams.toString()}`
		: "/checkout-return";
	const redirectTo = encodeURIComponent(returnPath);

	const { data } = useQuery({
		...orpc.payments.listPurchases.queryOptions({
			input: { organizationId },
		}),
		enabled: isAuthenticated,
		refetchInterval: isAuthenticated && polling ? POLL_INTERVAL_MS : false,
	});

	const purchases = data?.purchases ?? [];
	const entitlementGrants = data?.entitlementGrants ?? [];
	const { activePlan } = createPurchasesHelper(purchases, entitlementGrants);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		void fetch("/api/payments/claim", { method: "POST" });
	}, [isAuthenticated]);

	useEffect(() => {
		if (isAuthenticated && activePlan) {
			setPolling(false);
			router.replace("/");
		}
	}, [activePlan, isAuthenticated, router]);

	useEffect(() => {
		if (!isAuthenticated) {
			return;
		}

		const timer = setTimeout(() => {
			setPolling(false);
			router.replace("/choose-plan");
		}, MAX_WAIT_MS);

		return () => clearTimeout(timer);
	}, [isAuthenticated, router]);

	if (!isAuthenticated) {
		return (
			<div className="gap-4 py-8 flex flex-col items-center justify-center">
				<p className="max-w-md text-sm text-center text-muted-foreground">
					{t("anonymousActionDescription")}
				</p>
				<div className="gap-3 flex flex-wrap justify-center">
					<Button asChild>
						<Link href={`/login?redirectTo=${redirectTo}`}>{t("login")}</Link>
					</Button>
					<Button asChild variant="outline">
						<Link href={`/signup?redirectTo=${redirectTo}`}>{t("signup")}</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="gap-4 py-8 flex flex-col items-center justify-center">
			<Spinner className="size-8" />
			<p className="text-sm text-center text-muted-foreground">{t("loading")}</p>
		</div>
	);
}
