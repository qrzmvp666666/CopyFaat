import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { proxy } from "../../proxy";
import { getLocaleFromPath, localizePath, stripLocaleFromPath } from "./routing";

vi.mock("@talivia/bot-traffic/next", () => ({
	trackBotRequestInBackground: vi.fn(),
}));

const event = { waitUntil: vi.fn() } as unknown as NextFetchEvent;
const origin = "https://saas.example.com";

describe("SaaS language paths", () => {
	it("uses a path prefix without duplicating it", () => {
		expect(localizePath("/signals", "zh")).toBe("/zh/signals");
		expect(localizePath("/zh/signals", "en")).toBe("/en/signals");
		expect(localizePath("/checkout-return?session_id=cs_123", "en")).toBe(
			"/en/checkout-return?session_id=cs_123",
		);
		expect(getLocaleFromPath("/en/signals")).toBe("en");
		expect(stripLocaleFromPath("/zh/signals")).toBe("/signals");
		expect(localizePath("/", "en")).toBe("/en");
		expect(localizePath("/en?tab=all", "zh")).toBe("/zh?tab=all");
		expect(localizePath("https://example.com", "en")).toBe("https://example.com");
	});

	it("redirects legacy paths based on a valid cookie without losing ad parameters", () => {
		const req = new NextRequest(`${origin}/signals?utm_source=propellerads&click_id=abc789`, {
			headers: { cookie: "NEXT_LOCALE=en" },
		});
		const res = proxy(req, event);
		expect(res.status).toBe(307);
		expect(res.headers.get("location")).toBe(
			`${origin}/en/signals?utm_source=propellerads&click_id=abc789`,
		);
	});

	it("prefers the path over a stale cookie and sets the checkout return locale", () => {
		const req = new NextRequest(`${origin}/en/checkout-return?session_id=cs_123`, {
			headers: { cookie: "NEXT_LOCALE=zh" },
		});
		const res = proxy(req, event);
		expect(res.headers.get("x-middleware-rewrite")).toBe(
			`${origin}/checkout-return?session_id=cs_123`,
		);
		expect(res.headers.get("x-middleware-request-x-next-intl-locale")).toBe("en");
		expect(res.cookies.get("NEXT_LOCALE")?.value).toBe("en");
	});

	it("falls back to the default locale for an unsupported cookie", () => {
		const req = new NextRequest(`${origin}/signals`, {
			headers: { cookie: "NEXT_LOCALE=xx" },
		});
		expect(proxy(req, event).headers.get("location")).toBe(`${origin}/zh/signals`);
	});
});

describe("payment return language", () => {
	it("reads an explicit language on the shared provider return URL", () => {
		const req = new NextRequest(`${origin}/checkout-return?locale=en&session_id=cs_test`, {
			headers: { cookie: "NEXT_LOCALE=zh" },
		});
		expect(proxy(req, event).headers.get("location")).toBe(
			`${origin}/en/checkout-return?locale=en&session_id=cs_test`,
		);
	});
	it("remembers checkout language even if another tab switches app language", () => {
		const req = new NextRequest(`${origin}/checkout-return?session_id=cs_test`, {
			headers: { cookie: "NEXT_LOCALE=zh; signalfast_checkout_locale=en" },
		});
		expect(proxy(req, event).headers.get("location")).toBe(
			`${origin}/en/checkout-return?session_id=cs_test`,
		);
	});
});
