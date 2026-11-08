/** First-party attribution shared by Marketing and SaaS. Never contains account credentials. */
const KEY = "sf_ad_attribution";
const MAX_AGE = 30 * 24 * 60 * 60;
export interface AdAttribution {
	adPlatform?: string;
	adClickId?: string;
	adRecord?: string;
	utmSource?: string;
	utmMedium?: string;
	utmCampaign?: string;
	utmContent?: string;
	utmTerm?: string;
}
function cookieValue(name: string) {
	const value = document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`));
	try {
		return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
	} catch {
		return undefined;
	}
}
export function captureAdAttribution() {
	const params = new URLSearchParams(window.location.search);
	const source = params.get("utm_source");
	const clickId =
		params.get("click_id") ??
		params.get("gclid") ??
		params.get("fbclid") ??
		params.get("ttclid") ??
		params.get("msclkid");
	const record = params.get("record");
	if (!source && !clickId && !record) return;
	const data: AdAttribution = {
		adPlatform:
			source ??
			(params.has("gclid")
				? "google"
				: params.has("fbclid")
					? "meta"
					: params.has("ttclid")
						? "tiktok"
						: params.has("msclkid")
							? "microsoft"
							: undefined),
		adClickId: clickId ?? undefined,
		adRecord: source?.toLowerCase() === "adsgram" ? (record ?? undefined) : undefined,
		utmSource: source ?? undefined,
		utmMedium: params.get("utm_medium") ?? undefined,
		utmCampaign: params.get("utm_campaign") ?? undefined,
		utmContent: params.get("utm_content") ?? undefined,
		utmTerm: params.get("utm_term") ?? undefined,
	};
	const encoded = encodeURIComponent(
		JSON.stringify({ data, expiresAt: Date.now() + MAX_AGE * 1000 }),
	);
	if (encoded.length > 3500) return;
	// Share only within the project's owned production domain, never a public tunnel suffix.
	const host = window.location.hostname;
	const domain =
		host === "signalfast.cn" || host.endsWith(".signalfast.cn") ? "; Domain=signalfast.cn" : "";
	document.cookie = `${KEY}=${encoded}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${domain}${window.location.protocol === "https:" ? "; Secure" : ""}`;
	try {
		localStorage.setItem(KEY, decodeURIComponent(encoded));
	} catch {
		/* Cookie remains available. */
	}
}
export function readAdAttribution(): AdAttribution {
	try {
		const raw = cookieValue(KEY) ?? localStorage.getItem(KEY);
		const record = raw ? JSON.parse(raw) : null;
		return record?.expiresAt > Date.now() ? record.data : {};
	} catch {
		return {};
	}
}
export function readTaliviaIdentifiers() {
	// Verified against Talivia's collector: getSessionId() and first-party ID cookies.
	const talivia = (window as Window & { talivia?: { getSessionId?: () => string } }).talivia;
	return {
		taliviaVisitorId: cookieValue("talivia_visitor_id"),
		taliviaSessionId: talivia?.getSessionId?.() ?? cookieValue("talivia_session_id"),
	};
}
