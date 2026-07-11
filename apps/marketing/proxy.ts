import { routing } from "@i18n/routing-config";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export function proxy(req: NextRequest) {
	return intlMiddleware(req);
}

export const config = {
	matcher: [
		"/((?!api|images|fonts|_next/static|_next/image|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
	],
};
