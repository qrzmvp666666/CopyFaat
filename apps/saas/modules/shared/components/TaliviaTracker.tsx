"use client";

import Script from "next/script";

interface TaliviaTrackerProps {
	crossDomainDomains?: string;
	domain: string;
	websiteId: string;
}

export function TaliviaTracker({ crossDomainDomains, domain, websiteId }: TaliviaTrackerProps) {
	return (
		<Script
			src="https://talivia.com/script.js"
			data-website-id={websiteId}
			data-domain={domain}
			data-cross-domain-domains={crossDomainDomains}
			strategy="afterInteractive"
			onReady={() => {
				window.dispatchEvent(new Event("talivia:ready"));
			}}
		/>
	);
}
