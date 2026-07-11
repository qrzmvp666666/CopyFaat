"use client";

import { Button } from "@repo/ui/components/button";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import { CookieIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ConsentBanner() {
	const { consentStatus, acknowledgeCookies } = useCookieConsent();
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
						我们使用必要 Cookie 和 Mixpanel 产品分析来了解网站使用情况。详情请查看
						<Link className="underline" href="/legal/privacy-policy">
							隐私政策
						</Link>
						。
					</p>
					<div className="mt-4 flex justify-end">
						<Button className="flex-1" onClick={() => acknowledgeCookies()}>
							知道了
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
