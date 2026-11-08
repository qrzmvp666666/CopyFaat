import { CHECKOUT_LOCALE_COOKIE, isSupportedLocale } from "@i18n/routing";
import type { Locale } from "@repo/i18n";
import {
	captureAdAttribution,
	readAdAttribution,
	readTaliviaIdentifiers,
} from "@repo/utils/lib/checkout-attribution";
export async function prepareAttributedPaymentLink(
	paymentLink: string,
	provider: "stripe" | "yolfi",
	locale?: Locale,
) {
	const url = new URL(paymentLink);
	if (isSupportedLocale(locale) && typeof document !== "undefined") {
		// Payment Links have a fixed return URL; remember this checkout's language locally.
		document.cookie = `${CHECKOUT_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=604800; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
	}
	try {
		captureAdAttribution();
		const adAttribution = readAdAttribution();
		const identifiers = readTaliviaIdentifiers();
		const hasValidAdAttribution = Boolean(
			adAttribution.utmSource || adAttribution.adClickId || adAttribution.adRecord,
		);
		if (!hasValidAdAttribution) {
			if (provider === "stripe" && identifiers.taliviaSessionId)
				url.searchParams.set("client_reference_id", identifiers.taliviaSessionId);
			if (provider === "yolfi") {
				if (identifiers.taliviaSessionId)
					url.searchParams.set(
						"metadata[talivia_session_id]",
						identifiers.taliviaSessionId,
					);
				if (identifiers.taliviaVisitorId)
					url.searchParams.set(
						"metadata[talivia_visitor_id]",
						identifiers.taliviaVisitorId,
					);
			}
			return url.toString();
		}
		const response = await fetch("/api/payments/attribution", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				provider,
				paymentLinkUrl: `${url.origin}${url.pathname.replace(/\/$/, "")}`,
				...adAttribution,
				...identifiers,
			}),
			signal: AbortSignal.timeout(2500),
		});
		if (!response.ok) throw new Error(`Attribution request failed (${response.status})`);
		const { id } = (await response.json()) as { id?: string };
		if (!id) throw new Error("Attribution record was not created");
		if (provider === "stripe") {
			// Preserve Talivia's native Stripe reference. The database record carries the ad join.
			url.searchParams.set("client_reference_id", identifiers.taliviaSessionId ?? id);
		} else {
			url.searchParams.set("metadata[attribution_id]", id);
			if (identifiers.taliviaSessionId)
				url.searchParams.set("metadata[talivia_session_id]", identifiers.taliviaSessionId);
			if (identifiers.taliviaVisitorId)
				url.searchParams.set("metadata[talivia_visitor_id]", identifiers.taliviaVisitorId);
		}
	} catch (error) {
		throw new Error("Unable to save checkout attribution", { cause: error });
	}
	return url.toString();
}
