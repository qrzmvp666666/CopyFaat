import { config as i18nConfig, type Locale } from "@repo/i18n";

const locales = Object.keys(i18nConfig.locales) as Locale[];

export const CHECKOUT_LOCALE_COOKIE = "signalfast_checkout_locale";

export function isSupportedLocale(value: string | undefined): value is Locale {
	return locales.some((locale) => locale === value);
}

export function getLocaleFromPath(pathname: string): Locale | undefined {
	const segment = pathname.split(/[?#]/, 1)[0].split("/")[1];
	return isSupportedLocale(segment) ? segment : undefined;
}

export function localizePath(pathname: string, locale: Locale): string {
	if (!pathname.startsWith("/") || pathname.startsWith("//")) {
		return pathname;
	}
	const suffixIndex = pathname.search(/[?#]/);
	const path = suffixIndex < 0 ? pathname : pathname.slice(0, suffixIndex);
	const suffix = suffixIndex < 0 ? "" : pathname.slice(suffixIndex);
	const unprefixedPath = stripLocaleFromPath(path);
	return `/${locale}${unprefixedPath === "/" ? "" : unprefixedPath}${suffix}`;
}

export function stripLocaleFromPath(pathname: string): string {
	const locale = getLocaleFromPath(pathname);
	return locale ? pathname.slice(locale.length + 1) || "/" : pathname;
}
