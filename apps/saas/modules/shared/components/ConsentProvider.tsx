"use client";

import Cookies from "js-cookie";
import { createContext, useState } from "react";

type ConsentStatus = "acknowledged" | "pending";

export const ConsentContext = createContext<{
	consentStatus: ConsentStatus;
	acknowledgeCookies: () => void;
}>({
	consentStatus: "pending",
	acknowledgeCookies: () => {},
});

export function ConsentProvider({
	children,
	initialNotice,
}: {
	children: React.ReactNode;
	initialNotice?: string;
}) {
	const [consentStatus, setConsentStatus] = useState<ConsentStatus>(
		initialNotice === "true" ? "acknowledged" : "pending",
	);

	const acknowledgeCookies = () => {
		Cookies.set("analytics-notice", "true", { expires: 180, sameSite: "lax" });
		setConsentStatus("acknowledged");
	};

	return (
		<ConsentContext.Provider value={{ consentStatus, acknowledgeCookies }}>
			{children}
		</ConsentContext.Provider>
	);
}
