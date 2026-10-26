"use client";

import Cookies from "js-cookie";
import { createContext, useState } from "react";

export const ConsentContext = createContext<{
	userHasConsented: boolean;
	hasRespondedToConsent: boolean;
	allowCookies: () => void;
	declineCookies: () => void;
}>({
	userHasConsented: false,
	hasRespondedToConsent: false,
	allowCookies: () => {},
	declineCookies: () => {},
});

export function ConsentProvider({
	children,
	initialConsent,
	initialConsentResponse,
}: {
	children: React.ReactNode;
	initialConsent?: boolean;
	initialConsentResponse?: boolean;
}) {
	const [userHasConsented, setUserHasConsented] = useState(!!initialConsent);
	const [hasRespondedToConsent, setHasRespondedToConsent] = useState(!!initialConsentResponse);

	const allowCookies = () => {
		Cookies.set("consent", "true", { expires: 30 });
		setUserHasConsented(true);
		setHasRespondedToConsent(true);
	};

	const declineCookies = () => {
		Cookies.set("consent", "false", { expires: 30 });
		setUserHasConsented(false);
		setHasRespondedToConsent(true);
	};

	return (
		<ConsentContext.Provider
			value={{ userHasConsented, hasRespondedToConsent, allowCookies, declineCookies }}
		>
			{children}
		</ConsentContext.Provider>
	);
}
