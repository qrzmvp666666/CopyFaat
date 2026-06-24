"use client";

import { usePlanData } from "@payments/hooks/plan-data";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { toastError, toastSuccess } from "@repo/ui/components/toast";
import { cn } from "@repo/ui/lib";
import { SettingsItem } from "@shared/components/SettingsItem";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GiftIcon, TicketCheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BILLING_CARD_CLASS, BILLING_INSET_CLASS } from "./billing-surface-styles";

interface RedeemCodePanelProps {
	compact?: boolean;
	redirectTo?: string;
}

export function RedeemCodePanel({ compact = false, redirectTo }: RedeemCodePanelProps) {
	const t = useTranslations();
	const format = useFormatter();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { planData } = usePlanData();
	const [code, setCode] = useState("");

	const redeemHistoryQuery = useQuery(
		orpc.payments.listRedeemHistory.queryOptions({ input: {} }),
	);
	const redeemCodeMutation = useMutation(orpc.payments.redeemCode.mutationOptions());

	const redeemHistoryItems = redeemHistoryQuery.data ?? [];

	const onRedeem = async () => {
		const trimmedCode = code.trim();

		if (!trimmedCode) {
			toastError(t("settings.billing.redeemCode.notifications.empty.title"));
			return;
		}

		try {
			const result = await redeemCodeMutation.mutateAsync({
				code: trimmedCode,
			});

			if (!result.ok) {
				toastError(t(`settings.billing.redeemCode.notifications.${result.reason}.title`));
				return;
			}

			setCode("");
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.payments.listPurchases.key(),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.payments.listRedeemHistory.key(),
				}),
			]);
			if (redirectTo) {
				router.replace(redirectTo);
				router.refresh();
			}
			toastSuccess(t("settings.billing.redeemCode.notifications.success.title"));
		} catch {
			toastError(t("settings.billing.redeemCode.notifications.error.title"));
		}
	};

	const redeemForm = (
		<div
			className={cn(
				"gap-3 p-3 flex flex-col rounded-2xl border",
				BILLING_INSET_CLASS,
				"sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
			)}
		>
			<Input
				value={code}
				onChange={(event) => setCode(event.target.value)}
				placeholder={t("settings.billing.redeemCode.placeholder")}
				className="h-11 min-w-0 text-sm bg-card/80"
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						void onRedeem();
					}
				}}
			/>
			<Button
				variant="primary"
				className="h-11 px-5 sm:w-[120px] shadow-sm w-full whitespace-nowrap"
				onClick={() => void onRedeem()}
				loading={redeemCodeMutation.isPending}
			>
				<TicketCheckIcon className="size-4" />
				{t("settings.billing.redeemCode.submit")}
			</Button>
		</div>
	);

	const redeemHistoryList = (
		<div className={`overflow-hidden rounded-3xl border ${BILLING_CARD_CLASS}`}>
			<Table>
				<TableHeader>
					<TableRow className="dark:bg-white/[0.035] bg-muted/40">
						<TableHead>{t("settings.billing.redeemCode.history.plan")}</TableHead>
						<TableHead>{t("settings.billing.redeemCode.history.code")}</TableHead>
						<TableHead>{t("settings.billing.redeemCode.history.redeemedAt")}</TableHead>
						<TableHead>{t("settings.billing.redeemCode.history.expiresAt")}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{redeemHistoryItems.length > 0 ? (
						redeemHistoryItems.map((grant) => {
							const plan = planData[grant.planId as keyof typeof planData];
							const isActive = new Date(grant.expiresAt).getTime() > Date.now();

							return (
								<TableRow key={grant.id}>
									<TableCell>
										<div className="gap-2 flex items-center">
											<span>{plan?.title ?? grant.planId}</span>
											<Badge status={isActive ? "success" : "warning"}>
												{isActive
													? t(
															"settings.billing.redeemCode.history.active",
														)
													: t(
															"settings.billing.redeemCode.history.expired",
														)}
											</Badge>
										</div>
									</TableCell>
									<TableCell>{grant.redeemCode?.codePrefix ?? "—"}</TableCell>
									<TableCell>
										{format.dateTime(
											new Date(
												grant.redeemCode?.redeemedAt ?? grant.createdAt,
											),
											{
												dateStyle: "medium",
											},
										)}
									</TableCell>
									<TableCell>
										{format.dateTime(new Date(grant.expiresAt), {
											dateStyle: "medium",
										})}
									</TableCell>
								</TableRow>
							);
						})
					) : (
						<TableRow>
							<TableCell
								colSpan={4}
								className="h-24 text-center text-muted-foreground"
							>
								{t("settings.billing.redeemCode.history.empty")}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);

	if (!compact) {
		return (
			<div id="redeem-code" className="gap-4 flex flex-col">
				<SettingsItem
					title={
						<span className="gap-2 flex items-center">
							<GiftIcon className="size-4 text-muted-foreground" />
							{t("settings.billing.redeemCode.title")}
						</span>
					}
					description={t("settings.billing.redeemCode.description")}
				>
					{redeemForm}
				</SettingsItem>
				{redeemHistoryList}
			</div>
		);
	}

	return (
		<Card id="redeem-code">
			<CardHeader>
				<div className="gap-2 flex items-center">
					<GiftIcon className="size-5 text-primary" />
					<CardTitle>{t("settings.billing.redeemCode.title")}</CardTitle>
				</div>
				<CardDescription>{t("settings.billing.redeemCode.description")}</CardDescription>
			</CardHeader>
			<CardContent>{redeemForm}</CardContent>
		</Card>
	);
}
