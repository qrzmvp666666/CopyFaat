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
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
				"text-white bg-[#191919]",
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
					<div className="gap-2 flex items-center">
						{!isAuthenticated ? (
							<Link
								className="text-sm font-medium text-white/70 hover:text-white"
								href={`${localizePath("/login", locale)}?redirectTo=${encodeURIComponent(localizePath("/settings/billing", locale))}`}
							>
								{t("login")}
							</Link>
						) : null}
						<a
							href="https://t.me/Michael_Qin"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Telegram"
							title="Telegram"
							className="size-10 hover:bg-white/8 flex shrink-0 items-center justify-center rounded-md"
						>
							<Image
								src="/images/contact/telegram-monochrome.svg"
								className="opacity-75 invert transition-opacity hover:opacity-100"
								alt=""
								width={24}
								height={24}
							/>
						</a>
					</div>
				</header>

				<div className="min-h-0 px-6 pb-6 flex-1 overflow-y-auto [scrollbar-width:none]">
					<section className="pt-8 text-center">
						<Image
							alt="CopyFast"
							className="mx-auto object-contain"
							src="/images/brand/copyfast-logo.svg"
							width={48}
							height={48}
						/>
						<h1 className="mt-3 font-bold leading-8 text-[26px]">CopyFast Pro</h1>
						<p className="mt-2 text-sm leading-6 text-white/65">{t("description")}</p>
					</section>

					<PaywallSupportedMarkets />

					<div className="mt-7 h-10 p-1 text-xs grid grid-cols-2 rounded-full bg-[#242424]">
						<button
							aria-pressed={paymentMethod === "stablecoin"}
							className={cn(
								"rounded-full text-[#929293]",
								paymentMethod === "stablecoin" && "text-white bg-[#363636]",
							)}
							onClick={() => setPaymentMethod("stablecoin")}
							type="button"
						>
							{t("stablecoin")}
						</button>
						<button
							aria-pressed={paymentMethod === "card"}
							className={cn(
								"rounded-full text-[#929293]",
								paymentMethod === "card" && "text-white bg-[#363636]",
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
										? "border-[#71c684] bg-[#202020]"
										: "border-[#383838] bg-[#191919]",
								)}
								onClick={() => setPeriod("year")}
								type="button"
							>
								<span
									className={cn(
										"size-5 p-1 shrink-0 rounded-full border-2 border-[#71c684]",
										period === "year" && "border-[#71c684]",
									)}
								>
									<span
										className={cn(
											"block size-full rounded-full",
											period === "year" && "bg-[#71c684]",
										)}
									/>
								</span>
								<span className="min-w-0 flex-1">
									<span className="text-sm font-bold block">{t("yearly")}</span>
									<span className="mt-1 text-xs block text-[#a3a3a5]">
										{t("perYear")}
									</span>
								</span>
								<span className="shrink-0 text-right">
									<span className="text-sm font-bold block">US$1.92</span>
									<span className="mt-1 block text-[10px] text-[#a3a3a5]">
										{t("weeklyEquivalent")}
									</span>
								</span>
							</button>
							<span className="right-3 top-0 px-3 py-1 font-bold absolute z-10 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#71c684] to-[#71c684] text-[10px] leading-none text-[#171717]">
								{t("bestValue")}
							</span>
						</div>
						<button
							aria-pressed={period === "week"}
							className={cn(
								"gap-3 px-4 py-3 flex min-h-[72px] items-center rounded-2xl border text-left transition-colors",
								period === "week"
									? "border-[#71c684] bg-[#202020]"
									: "border-[#383838] bg-[#191919]",
							)}
							onClick={() => setPeriod("week")}
							type="button"
						>
							<span
								className={cn(
									"size-5 p-1 shrink-0 rounded-full border-2 border-[#777777]",
									period === "week" && "border-[#71c684]",
								)}
							>
								<span
									className={cn(
										"block size-full rounded-full",
										period === "week" && "bg-[#71c684]",
									)}
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="text-sm font-bold block">{t("weekly")}</span>
								<span className="mt-1 text-xs block text-[#a3a3a5]">
									{t("payWeekly")}
								</span>
							</span>
							<span className="text-sm font-bold shrink-0">{t("perWeek")}</span>
						</button>
					</div>
					<PaywallPlanComparison />
				</div>

				<footer className="px-6 pt-3 shrink-0 bg-[#191919] pb-[max(env(safe-area-inset-bottom),16px)]">
					<PaywallOfferCountdown />
					<Button
						className="h-12 text-base font-bold hover:bg-white w-full rounded-lg bg-[#f1f1f1] text-[#171717]"
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

const PAYWALL_OFFER_STORAGE_KEY = "signalfast:paywall-offer-deadline:v1";
const PAYWALL_OFFER_DURATION = 7 * 24 * 60 * 60 * 1000;

function PaywallOfferCountdown() {
	const t = useTranslations("signals.mobilePaywall.countdown");
	const [remaining, setRemaining] = useState<number | null>(null);
	const deadlineRef = useRef<number | null>(null);

	useEffect(() => {
		let deadline = deadlineRef.current ?? Date.now() + PAYWALL_OFFER_DURATION;
		try {
			const stored = Number(window.localStorage.getItem(PAYWALL_OFFER_STORAGE_KEY));
			if (Number.isFinite(stored) && stored > 0) deadline = stored;
			else window.localStorage.setItem(PAYWALL_OFFER_STORAGE_KEY, String(deadline));
		} catch {
			// Keep the countdown usable when browser storage is unavailable.
		}
		deadlineRef.current = deadline;
		function updateRemaining() {
			setRemaining(Math.max(0, deadline - Date.now()));
		}
		updateRemaining();
		const timer = window.setInterval(updateRemaining, 1000);
		return () => window.clearInterval(timer);
	}, []);

	const totalSeconds = remaining === null ? null : Math.ceil(remaining / 1000);
	const days = totalSeconds === null ? 7 : Math.floor(totalSeconds / 86400);
	const hours = totalSeconds === null ? 0 : Math.floor((totalSeconds % 86400) / 3600);
	const minutes = totalSeconds === null ? 0 : Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds === null ? 0 : totalSeconds % 60;
	const format = (value: number) => String(value).padStart(2, "0");

	return (
		<div className="mb-3 gap-x-2 gap-y-1 text-xs flex flex-wrap items-center justify-center">
			<span className="text-white/60">{remaining === 0 ? t("ended") : t("label")}</span>
			<span
				role="timer"
				aria-label={t("remaining", { days, hours, minutes, seconds })}
				className="font-mono font-semibold text-[#71c684] tabular-nums"
			>
				{days}
				{t("days")} {format(hours)}:{format(minutes)}:{format(seconds)}
			</span>
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
											className="h-10 gap-2 py-1.5 pl-1.5 pr-4 text-xs font-medium text-white/90 flex shrink-0 items-center rounded-full bg-[#282828]"
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
		<div className="mt-5 border-white/10 overflow-hidden rounded-2xl border bg-[#202020]">
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
							className="px-1 py-2.5 font-semibold bg-[#71c684]/[0.08] text-[#71c684]"
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
								<td className="px-1 py-2.5 bg-[#71c684]/[0.08] text-center">
									<span className="gap-1 inline-flex flex-wrap items-center justify-center text-[#71c684]">
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
