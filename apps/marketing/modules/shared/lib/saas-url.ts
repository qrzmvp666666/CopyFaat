import { config } from "@config";

export function getSaasUrl(locale: string, path: string) {
	const base = config.saasUrl?.replace(/\/$/, "") || "http://signalfast.localhost:4100";
	return `${base}/${locale}${path}`;
}
