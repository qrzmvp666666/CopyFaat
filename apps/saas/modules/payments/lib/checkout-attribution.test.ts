import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareAttributedPaymentLink } from "./checkout-attribution";

vi.mock("@repo/utils/lib/checkout-attribution", () => ({
	captureAdAttribution: vi.fn(),
	readAdAttribution: () => ({ adPlatform: "propellerads", adClickId: "abc789" }),
	readTaliviaIdentifiers: () => ({ taliviaVisitorId: "v_test", taliviaSessionId: "s_test" }),
}));
afterEach(() => vi.unstubAllGlobals());
describe("payment link attribution", () => {
	it("preserves Talivia's Stripe session reference and the prefilled email", async () => {
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "sf_test" }));
		vi.stubGlobal("fetch", fetchMock);
		const url = new URL(
			await prepareAttributedPaymentLink(
				"https://buy.stripe.com/test?prefilled_email=a%40b.com",
				"stripe",
			),
		);
		expect(url.searchParams.get("client_reference_id")).toBe("s_test");
		expect(url.searchParams.get("prefilled_email")).toBe("a@b.com");
		expect(JSON.parse(fetchMock.mock.calls[0][1].body).adClickId).toBe("abc789");
	});
	it("remembers the payment language without losing advertising context", async () => {
		const documentMock = { cookie: "" };
		vi.stubGlobal("document", documentMock);
		vi.stubGlobal("window", { location: { protocol: "https:" } });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "sf_test" })));
		await prepareAttributedPaymentLink("https://buy.stripe.com/test", "stripe", "en");
		expect(documentMock.cookie).toContain("signalfast_checkout_locale=en");
		expect(documentMock.cookie).toContain("SameSite=Lax; Secure");
	});
	it("sends the database reference through Yolfi metadata", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "sf_test" })));
		const url = new URL(
			await prepareAttributedPaymentLink("https://pay.yolfi.com/link", "yolfi"),
		);
		expect(url.searchParams.get("metadata[attribution_id]")).toBe("sf_test");
		expect(url.searchParams.get("metadata[talivia_visitor_id]")).toBe("v_test");
	});
	it("blocks checkout when attribution storage fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
		await expect(
			prepareAttributedPaymentLink("https://buy.stripe.com/test", "stripe"),
		).rejects.toThrow("Unable to save checkout attribution");
	});
	it("blocks checkout when the attribution endpoint rejects the request", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
		await expect(
			prepareAttributedPaymentLink("https://buy.stripe.com/test", "stripe"),
		).rejects.toThrow("Unable to save checkout attribution");
	});
});
