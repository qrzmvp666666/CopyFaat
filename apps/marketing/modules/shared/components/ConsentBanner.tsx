"use client";

import { Button } from "@repo/ui/components/button";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import { CookieIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function ConsentBanner() {
	const { consentStatus, allowCookies, declineCookies } = useCookieConsent();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	if (consentStatus !== "pending") {
		return null;
	}

	return (
		<div className="left-4 bottom-4 max-w-md fixed z-50">
			<div className="gap-4 p-4 shadow-xl flex rounded-lg border bg-card text-card-foreground">
				<CookieIcon className="size-6 text-5xl mt-1 block shrink-0 text-primary/60" />
				<div>
					<p className="text-sm leading-normal">
						We use essential cookies and, with your permission, analytics cookies to
						understand site usage. Read our privacy policy.
					</p>
					<div className="mt-4 gap-2 flex">
						<Button
							variant="secondary"
							className="flex-1"
							onClick={() => declineCookies()}
						>
							Decline
						</Button>
						<Button className="flex-1" onClick={() => allowCookies()}>
							Allow
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
