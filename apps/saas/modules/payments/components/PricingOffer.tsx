"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const OFFER_KEY = "signalfast:paywall-offer-deadline:v1";
const OFFER_DURATION = 7 * 24 * 60 * 60 * 1000;
const DEMO_REMAINING_SPOTS = 23;

export function PricingOffer() {
	const t = useTranslations("pricingComparison");
	const [remaining, setRemaining] = useState<number | null>(null);
	useEffect(() => {
		let deadline = Date.now() + OFFER_DURATION;
		try {
			const stored = Number(window.localStorage.getItem(OFFER_KEY));
			if (Number.isFinite(stored) && stored > 0) deadline = stored;
			else window.localStorage.setItem(OFFER_KEY, String(deadline));
		} catch {}
		const update = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
		update();
		const timer = window.setInterval(update, 1000);
		return () => window.clearInterval(timer);
	}, []);
	const days = remaining === null ? "--" : Math.floor(remaining / 86400);
	const time =
		remaining === null
			? "--:--:--"
			: [
					Math.floor((remaining % 86400) / 3600),
					Math.floor((remaining % 3600) / 60),
					remaining % 60,
				]
					.map((value) => String(value).padStart(2, "0"))
					.join(":");
	return (
		<div className="island-offer">
			<span>{remaining === 0 ? t("offerEnded") : t("offerEnds")}</span>
			{remaining !== 0 && (
				<span role="timer" className="island-offer-time">
					{t("offerDays", { count: days })} {time}
				</span>
			)}
			{remaining !== 0 && (
				<span className="island-offer-spots">
					{t("remainingSpots", { count: DEMO_REMAINING_SPOTS })}
				</span>
			)}
		</div>
	);
}
