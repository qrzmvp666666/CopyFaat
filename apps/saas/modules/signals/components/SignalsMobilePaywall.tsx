"use client";

import { useSession } from "@auth/hooks/use-session";
import { trackTaliviaCheckoutStarted } from "@auth/lib/talivia";
import { localizePath } from "@i18n/routing";
import { prepareAttributedPaymentLink } from "@payments/lib/checkout-attribution";
import type { Locale } from "@repo/i18n";
import { config as storageConfig } from "@repo/storage/config";
import { cn } from "@repo/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import { toastError } from "@repo/ui/components/toast";
import type { SignalsPreviewResponse } from "@signals/lib/signal-types";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronLeftIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState } from "react";

interface SignalsMobilePaywallProps {
	isAuthenticated: boolean;
	open: boolean;
	onClose: () => void;
	embedded?: boolean;
	initialPeriod?: "year" | "week";
	onCheckoutStarted?: () => void;
}

const YOLFI_WEEKLY_PAYMENT_LINK =
	process.env.NEXT_PUBLIC_YOLFI_PRO_WEEKLY_PAYMENT_LINK ??
	"https://pay.yolfi.com/340ba658-394f-439c-9abc-36985d2383d3";
const YOLFI_YEARLY_PAYMENT_LINK =
	process.env.NEXT_PUBLIC_YOLFI_PRO_YEARLY_PAYMENT_LINK ??
	"https://pay.yolfi.com/75797130-8b5c-4814-8266-204472a4be16";
const STRIPE_WEEKLY_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PRO_WEEKLY_PAYMENT_LINK ?? "";
const STRIPE_YEARLY_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PAYMENT_LINK ?? "";

function getYolfiPaymentLinkUrl(paymentLink: string, locale: Locale, email?: string) {
	const url = new URL(paymentLink);
	const paylinkId = url.pathname.split("/").filter(Boolean).at(-1);
	if (paylinkId) url.pathname = `/${locale === "zh" ? "zh-CN" : "en"}/${paylinkId}`;
	if (email) url.searchParams.set("email", email);
	return url.toString();
}

function getStripePaymentLinkUrl(paymentLink: string, email?: string) {
	const url = new URL(paymentLink);
	if (email) url.searchParams.set("prefilled_email", email);
	return url.toString();
}

export function SignalsMobilePaywall({
	isAuthenticated,
	onClose,
	open,
	embedded = false,
	initialPeriod = "year",
	onCheckoutStarted,
}: SignalsMobilePaywallProps) {
	const { user } = useSession();
	const locale = useLocale() as Locale;
	const t = useTranslations("signals.mobilePaywall");
	const [paymentMethod, setPaymentMethod] = useState<"card" | "stablecoin">("stablecoin");
	const [period, setPeriod] = useState<"year" | "week">(initialPeriod);
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);
	const checkoutInFlight = useRef(false);
	if (!open) return null;

	async function startCheckout() {
		if (checkoutInFlight.current) return;
		const provider = paymentMethod === "stablecoin" ? "yolfi" : "stripe";
		const paymentLink =
			provider === "yolfi"
				? period === "year"
					? YOLFI_YEARLY_PAYMENT_LINK
					: YOLFI_WEEKLY_PAYMENT_LINK
				: period === "year"
					? STRIPE_YEARLY_PAYMENT_LINK
					: STRIPE_WEEKLY_PAYMENT_LINK;
		if (!paymentLink) {
			toastError(t("errorTitle"), t("errorDescription"));
			return;
		}
		checkoutInFlight.current = true;
		setIsStartingCheckout(true);
		trackTaliviaCheckoutStarted();
		const target =
			provider === "yolfi"
				? getYolfiPaymentLinkUrl(
						paymentLink,
						locale,
						isAuthenticated ? user?.email : undefined,
					)
				: getStripePaymentLinkUrl(paymentLink, user?.email);
		try {
			const checkoutUrl = await prepareAttributedPaymentLink(target, provider, locale);
			onCheckoutStarted?.();
			window.location.href = checkoutUrl;
		} catch {
			checkoutInFlight.current = false;
			setIsStartingCheckout(false);
			toastError(t("attributionErrorTitle"), t("attributionErrorDescription"));
		}
	}

	return (
		<div
			className={cn(
				"text-white bg-[#050506]",
				embedded ? "relative overflow-hidden rounded-2xl" : "inset-0 fixed z-[60]",
			)}
		>
			<style>{`
				@keyframes benefit-slide-left {
					to { transform: translateX(-50%); }
				}
				@keyframes benefit-slide-right {
					from { transform: translateX(-50%); }
					to { transform: translateX(0); }
				}
			`}</style>
			<div
				className={cn(
					"mx-auto flex w-full max-w-[430px] flex-col",
					embedded ? "min-h-[680px]" : "h-[100dvh]",
				)}
			>
				<header className="px-5 h-14 flex shrink-0 items-center justify-between pt-[max(env(safe-area-inset-top),16px)]">
					{!embedded ? (
						<button
							aria-label={t("back")}
							className="text-white/75 hover:text-white size-10 flex items-center justify-center"
							onClick={onClose}
							type="button"
						>
							<ChevronLeftIcon className="size-5" />
						</button>
					) : (
						<span className="w-10" />
					)}
					{!isAuthenticated ? (
						<Link
							className="text-sm font-medium text-white/70 hover:text-white"
							href={`${localizePath("/login", locale)}?redirectTo=${encodeURIComponent(localizePath("/signals", locale))}`}
						>
							{t("login")}
						</Link>
					) : (
						<span className="w-10" />
					)}
				</header>

				<div className="min-h-0 px-6 pb-6 flex-1 overflow-y-auto [scrollbar-width:none]">
					<section className="pt-8 text-center">
						<img
							alt="SignalFast"
							className="size-14 mx-auto rounded-2xl object-contain"
							src="/images/paywall/signalfast-logo.png"
						/>
						<h1 className="mt-3 font-bold leading-8 text-[26px]">SignalFast Pro</h1>
						<p className="mt-2 text-sm leading-6 text-white/65">{t("description")}</p>
					</section>

					<PaywallSupportedMarkets />

					<div className="mt-7 h-10 p-1 text-xs grid grid-cols-2 rounded-full bg-[#1b1a20]">
						<button
							aria-pressed={paymentMethod === "stablecoin"}
							className={cn(
								"rounded-full text-[#9a97a1]",
								paymentMethod === "stablecoin" && "text-white bg-[#414047]",
							)}
							onClick={() => setPaymentMethod("stablecoin")}
							type="button"
						>
							{t("stablecoin")}
						</button>
						<button
							aria-pressed={paymentMethod === "card"}
							className={cn(
								"rounded-full text-[#9a97a1]",
								paymentMethod === "card" && "text-white bg-[#414047]",
							)}
							onClick={() => setPaymentMethod("card")}
							type="button"
						>
							{t("card")}
						</button>
					</div>

					<div className="mt-5 gap-3 flex flex-col">
						<div className="relative">
							<button
								aria-pressed={period === "year"}
								className={cn(
									"gap-3 px-4 py-3 flex min-h-[82px] w-full items-center rounded-2xl border text-left transition-colors",
									period === "year"
										? "border-[#b5f2ff] bg-[#101014]"
										: "border-[#38363f] bg-[#09090c]",
								)}
								onClick={() => setPeriod("year")}
								type="button"
							>
								<span
									className={cn(
										"size-5 p-1 shrink-0 rounded-full border-2 border-[#b9ebff]",
										period === "year" && "border-[#d8baff]",
									)}
								>
									<span
										className={cn(
											"block size-full rounded-full",
											period === "year" && "bg-[#d8baff]",
										)}
									/>
								</span>
								<span className="min-w-0 flex-1">
									<span className="text-sm font-bold block">{t("yearly")}</span>
									<span className="mt-1 text-xs block text-[#aaa6b1]">
										{t("perYear")}
									</span>
								</span>
								<span className="shrink-0 text-right">
									<span className="text-sm font-bold block">US$1.92</span>
									<span className="mt-1 block text-[10px] text-[#aaa6b1]">
										{t("weeklyEquivalent")}
									</span>
								</span>
							</button>
							<span className="right-3 top-0 px-3 py-1 font-bold absolute z-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#9ceeff] to-[#e7b9ff] text-[10px] leading-none text-[#17131e]">
								{t("bestValue")}
							</span>
						</div>
						<button
							aria-pressed={period === "week"}
							className={cn(
								"gap-3 px-4 py-3 flex min-h-[72px] items-center rounded-2xl border text-left transition-colors",
								period === "week"
									? "border-[#b5f2ff] bg-[#101014]"
									: "border-[#38363f] bg-[#09090c]",
							)}
							onClick={() => setPeriod("week")}
							type="button"
						>
							<span
								className={cn(
									"size-5 p-1 shrink-0 rounded-full border-2 border-[#77737e]",
									period === "week" && "border-[#d8baff]",
								)}
							>
								<span
									className={cn(
										"block size-full rounded-full",
										period === "week" && "bg-[#d8baff]",
									)}
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="text-sm font-bold block">{t("weekly")}</span>
								<span className="mt-1 text-xs block text-[#aaa6b1]">
									{t("payWeekly")}
								</span>
							</span>
							<span className="text-sm font-bold shrink-0">{t("perWeek")}</span>
						</button>
					</div>
					<PaywallPlanComparison />
				</div>

				<footer className="px-6 pt-3 bg-[#0c0c0e] pb-[max(env(safe-area-inset-bottom),16px)]">
					<Button
						className="h-12 text-base font-bold w-full rounded-full bg-gradient-to-r from-[#a4efff] to-[#e8baff] text-[#17131e] hover:brightness-105"
						disabled={isStartingCheckout}
						onClick={startCheckout}
					>
						{t("unlock")}
					</Button>
				</footer>
			</div>
		</div>
	);
}

function PaywallSupportedMarkets() {
	const t = useTranslations("signals.mobilePaywall");
	const { data, isPending } = useQuery<SignalsPreviewResponse>({
		queryKey: ["signals", "paywall-preview"],
		queryFn: async () => {
			const response = await fetch("/api/signals/preview");
			if (!response.ok) throw new Error("Unable to load supported markets");
			return response.json();
		},
		staleTime: 60_000,
	});

	if (isPending) {
		return (
			<div
				aria-hidden="true"
				className="mt-7 animate-pulse bg-white/5 h-[88px] rounded-2xl"
			/>
		);
	}
	if (!data || (!data.sources.length && !data.tradingSymbols.length)) return null;

	return (
		<div className="mt-7 -mx-6 space-y-2 overflow-hidden">
			{[
				{
					label: t("supportedKols"),
					animation: "animate-[benefit-slide-left_24s_linear_infinite]",
					items: data.sources.map((source) => ({
						id: source.id ?? source.name,
						name: source.name,
						image: source.avatarUrl,
					})),
				},
				{
					label: t("supportedContracts"),
					animation: "animate-[benefit-slide-right_28s_linear_infinite]",
					items: data.tradingSymbols.map((symbol) => ({
						id: symbol.id,
						name: symbol.displayName ?? symbol.symbol,
						image: symbol.logoUrl,
					})),
				},
			].map((row) =>
				row.items.length ? (
					<div key={row.label} role="group" aria-label={row.label}>
						<div className={cn("flex w-max motion-reduce:animate-none", row.animation)}>
							{[false, true].map((duplicate) => (
								<div
									key={String(duplicate)}
									aria-hidden={duplicate || undefined}
									className="gap-2 px-1 flex shrink-0"
								>
									{row.items.map((item) => (
										<div
											key={item.id}
											className="h-10 gap-2 py-1.5 pl-1.5 pr-4 text-xs font-medium text-white/90 flex shrink-0 items-center rounded-full bg-[#242329]"
										>
											<Avatar className="size-7 shrink-0 rounded-full">
												<AvatarImage
													alt=""
													src={
														item.image &&
														!item.image.startsWith("/") &&
														!item.image.startsWith("http")
															? `/image-proxy/${storageConfig.bucketNames.avatars}/${item.image}`
															: item.image
													}
												/>
												<AvatarFallback className="bg-white/10 text-white/75 text-[10px]">
													{item.name.slice(0, 2)}
												</AvatarFallback>
											</Avatar>
											<span>{item.name}</span>
										</div>
									))}
								</div>
							))}
						</div>
					</div>
				) : null,
			)}
		</div>
	);
}

function PaywallPlanComparison() {
	const t = useTranslations("signals.guide.comparison");

	return (
		<div className="mt-5 border-white/10 overflow-hidden rounded-2xl border bg-[#101014]">
			<table aria-label={t("feature")} className="leading-4 w-full table-fixed text-[11px]">
				<thead>
					<tr className="border-white/10 text-white/60 border-b">
						<th scope="col" className="px-3 py-2.5 font-medium w-[48%] text-left">
							{t("feature")}
						</th>
						<th scope="col" className="px-1 py-2.5 font-medium w-[30%]">
							{t("free")}
						</th>
						<th
							scope="col"
							className="px-1 py-2.5 font-semibold bg-[#a4efff]/[0.08] text-[#a4efff]"
						>
							Pro
						</th>
					</tr>
				</thead>
				<tbody>
					{(["market", "signals", "levels", "filters", "devices"] as const).map(
						(feature) => (
							<tr
								key={feature}
								className="border-white/[0.06] border-b last:border-0"
							>
								<th
									scope="row"
									className="px-3 py-2.5 font-normal text-white/80 text-left"
								>
									{t(feature)}
								</th>
								<td className="px-1 py-2.5 text-white/50 text-center">
									{t(`otherFeatures.${feature}`)}
								</td>
								<td className="px-1 py-2.5 bg-[#a4efff]/[0.08] text-center">
									<span className="gap-1 inline-flex flex-wrap items-center justify-center text-[#a4efff]">
										<CheckIcon
											aria-hidden="true"
											className="size-3.5 shrink-0"
										/>
										<span>
											{t(feature === "devices" ? "included" : "automatic")}
										</span>
									</span>
								</td>
							</tr>
						),
					)}
				</tbody>
			</table>
		</div>
	);
}
