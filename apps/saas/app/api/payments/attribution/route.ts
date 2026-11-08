import { randomUUID } from "node:crypto";

import { createCheckoutAttribution } from "@repo/database";
import { NextResponse } from "next/server";
import { z } from "zod";

const text = z.string().max(512).optional();
const schema = z.object({
	provider: z.enum(["stripe", "yolfi"]),
	paymentLinkUrl: z.url().max(2048),
	adPlatform: z.string().max(80).optional(),
	adClickId: text,
	adRecord: z.string().max(2048).optional(),
	taliviaVisitorId: text,
	taliviaSessionId: text,
	utmSource: text,
	utmMedium: text,
	utmCampaign: text,
	utmContent: text,
	utmTerm: text,
});

function getAllowedOrigins(request: Request) {
	const origins = new Set([new URL(request.url).origin]);
	const requestHost = request.headers.get("host");
	const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
	const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
	const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");

	for (const host of [requestHost, forwardedHost]) {
		if (!host) continue;
		try {
			origins.add(new URL(`${protocol}://${host}`).origin);
		} catch {
			// Ignore malformed proxy headers; the request origin remains the fallback.
		}
	}

	try {
		if (process.env.NEXT_PUBLIC_SAAS_URL)
			origins.add(new URL(process.env.NEXT_PUBLIC_SAAS_URL).origin);
	} catch {
		// Ignore malformed optional public URL configuration.
	}

	return origins;
}

export async function POST(request: Request) {
	const origin = request.headers.get("origin");
	if (!origin || !getAllowedOrigins(request).has(origin))
		return new Response(null, { status: 403 });
	if (Number(request.headers.get("content-length")) > 8192)
		return new Response(null, { status: 413 });
	try {
		const body = await request.text();
		if (body.length > 8192) return new Response(null, { status: 413 });
		const input = schema.safeParse(JSON.parse(body));
		if (!input.success) return new Response(null, { status: 400 });
		const url = new URL(input.data.paymentLinkUrl);
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			(input.data.provider === "stripe"
				? url.hostname !== "buy.stripe.com"
				: url.hostname !== "pay.yolfi.com")
		) {
			return new Response(null, { status: 400 });
		}
		const id = `sf_${randomUUID().replaceAll("-", "")}`;
		await createCheckoutAttribution({
			id,
			...input.data,
			paymentLinkUrl: `${url.origin}${url.pathname.replace(/\/$/, "")}`,
		});
		return NextResponse.json({ id }, { headers: { "Cache-Control": "no-store" } });
	} catch {
		return new Response(null, { status: 503 });
	}
}
