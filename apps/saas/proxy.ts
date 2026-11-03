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

	return NextResponse.next();
}
