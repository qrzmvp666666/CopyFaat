"use client";
import { useSession } from "@auth/hooks/use-session";
import { trackTaliviaCheckoutStarted } from "@auth/lib/talivia";
import { prepareAttributedPaymentLink } from "@payments/lib/checkout-attribution";
import type { Locale } from "@repo/i18n";
import { toastError } from "@repo/ui/components/toast";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

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

export function useProCheckout({
	initialPeriod = "year",
	onCheckoutStarted,
	isAuthenticated,
}: {
	initialPeriod?: "year" | "week";
	onCheckoutStarted?: () => void;
	isAuthenticated: boolean;
}) {
	const { user } = useSession();
	const locale = useLocale() as Locale;
	const t = useTranslations("signals.mobilePaywall");
	const [paymentMethod, setPaymentMethod] = useState<"card" | "stablecoin">("stablecoin");
	const [period, setPeriod] = useState<"year" | "week">(initialPeriod);
	const [isStartingCheckout, setIsStartingCheckout] = useState(false);
	const checkoutInFlight = useRef(false);
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

	return {
		paymentMethod,
		setPaymentMethod,
		period,
		setPeriod,
		isStartingCheckout,
		startCheckout,
	};
}
