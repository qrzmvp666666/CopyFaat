"use client";

import Cookies from "js-cookie";
import { createContext, useState } from "react";

type ConsentStatus = "accepted" | "declined" | "pending";

export const ConsentContext = createContext<{
	consentStatus: ConsentStatus;
	userHasConsented: boolean;
	allowCookies: () => void;
	declineCookies: () => void;
}>({
	consentStatus: "pending",
	userHasConsented: false,
	allowCookies: () => {},
	declineCookies: () => {},
});

export function ConsentProvider({
	children,
	initialConsent,
}: {
	children: React.ReactNode;
	initialConsent?: string;
}) {
	const [consentStatus, setConsentStatus] = useState<ConsentStatus>(
		initialConsent === "true"
			? "accepted"
			: initialConsent === "false"
				? "declined"
				: "pending",
	);
	const userHasConsented = consentStatus === "accepted";

	const allowCookies = () => {
		Cookies.set("analytics-consent", "true", { expires: 180, sameSite: "lax" });
		setConsentStatus("accepted");
	};

	const declineCookies = () => {
		Cookies.set("analytics-consent", "false", { expires: 180, sameSite: "lax" });
		setConsentStatus("declined");
	};

	return (
		<ConsentContext.Provider
			value={{ consentStatus, userHasConsented, allowCookies, declineCookies }}
		>
			{children}
		</ConsentContext.Provider>
	);
}
