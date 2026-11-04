import {
	CHECKOUT_LOCALE_COOKIE,
	isSupportedLocale,
	getLocaleFromPath,
	localizePath,
} from "@i18n/routing";
import { config as i18nConfig, type Locale } from "@repo/i18n";
import { trackBotRequestInBackground } from "@talivia/bot-traffic/next";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

export function proxy(request: NextRequest, event: NextFetchEvent) {
	const domain = process.env.TALIVIA_DOMAIN;
	const publicOrigin = domain
		? `${domain.startsWith("http://") || domain.startsWith("https://") ? "" : "https://"}${domain}`
		: undefined;

	trackBotRequestInBackground(
		request,
		{
			token: process.env.TALIVIA_BOT_TOKEN,
			publicOrigin,
		},
		event,
	);

	const pathname = request.nextUrl.pathname;
	const pathLocale = getLocaleFromPath(pathname);
	if (!pathLocale) {
		const cookieLocale = request.cookies.get(i18nConfig.localeCookieName)?.value;
		const returnLocale =
			pathname === "/checkout-return"
				? (request.nextUrl.searchParams.get("locale") ??
					request.cookies.get(CHECKOUT_LOCALE_COOKIE)?.value)
				: undefined;
		const requestedLocale = returnLocale ?? undefined;
		const locale: Locale = isSupportedLocale(requestedLocale)
			? requestedLocale
			: isSupportedLocale(cookieLocale)
				? cookieLocale
				: i18nConfig.defaultLocale;
		const target = new URL(request.url);
		target.pathname = localizePath(pathname, locale);
		return NextResponse.redirect(target);
	}

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("X-NEXT-INTL-LOCALE", pathLocale);
	const target = new URL(request.url);
	target.pathname = pathname.slice(pathLocale.length + 1) || "/";
	const response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
	response.cookies.set(i18nConfig.localeCookieName, pathLocale, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
		secure: request.nextUrl.protocol === "https:",
	});
	return response;
}

export const config = {
	matcher: [
		"/((?!api(?:/|$)|_next(?:/|$)|image-proxy(?:/|$)|images(?:/|$)|fonts(?:/|$)|videos(?:/|$)|.*\\..*).*)",
	],
};
