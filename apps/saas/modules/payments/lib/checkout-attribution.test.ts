import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { prepareAttributedPaymentLink } from "./checkout-attribution";

vi.mock("@repo/utils/lib/checkout-attribution", () => ({
	captureAdAttribution: vi.fn(),
	readAdAttribution: vi.fn(() => ({ adPlatform: "propellerads", adClickId: "abc789" })),
	readTaliviaIdentifiers: () => ({ taliviaVisitorId: "v_test", taliviaSessionId: "s_test" }),
}));
import { readAdAttribution } from "@repo/utils/lib/checkout-attribution";

beforeEach(() =>
	vi
		.mocked(readAdAttribution)
		.mockReturnValue({ adPlatform: "propellerads", adClickId: "abc789" }),
);
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
	it("skips empty attribution records but preserves the checkout and Talivia context", async () => {
		vi.mocked(readAdAttribution).mockReturnValue({ utmCampaign: "campaign-only" });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const url = new URL(
			await prepareAttributedPaymentLink("https://buy.stripe.com/test", "stripe"),
		);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(url.searchParams.get("client_reference_id")).toBe("s_test");
	});
	it("accepts a UTM source without a click ID as valid attribution", async () => {
		vi.mocked(readAdAttribution).mockReturnValue({ utmSource: "propellerads" });
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "sf_test" }));
		vi.stubGlobal("fetch", fetchMock);
		await prepareAttributedPaymentLink("https://buy.stripe.com/test", "stripe");
		expect(fetchMock).toHaveBeenCalledOnce();
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

describe("AdsGram checkout correlation", () => {
	it.each(["stripe", "yolfi"] as const)(
		"saves record-only attribution before %s checkout",
		async (provider) => {
			vi.mocked(readAdAttribution).mockReturnValue({
				adPlatform: "adsgram",
				adRecord: "R001",
			});
			const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "sf_adsgram" }));
			vi.stubGlobal("fetch", fetchMock);
			const url = new URL(
				await prepareAttributedPaymentLink(
					provider === "stripe"
						? "https://buy.stripe.com/test"
						: "https://pay.yolfi.com/link",
					provider,
				),
			);
			expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
				provider,
				adPlatform: "adsgram",
				adRecord: "R001",
				taliviaSessionId: "s_test",
			});
			expect(
				url.searchParams.get(
					provider === "stripe" ? "client_reference_id" : "metadata[attribution_id]",
				),
			).toBe(provider === "stripe" ? "s_test" : "sf_adsgram");
			expect(url.searchParams.has("record")).toBe(false);
		},
	);
});
