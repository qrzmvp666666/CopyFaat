import { captureAdAttribution, readAdAttribution } from "@repo/utils/lib/checkout-attribution";
import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());
describe("first-party advertising context", () => {
	it("captures the PropellerAds link and shares it only on owned subdomains", () => {
		const documentMock = { cookie: "" };
		vi.stubGlobal("document", documentMock);
		vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn() });
		vi.stubGlobal("window", {
			location: {
				search: "?utm_source=propellerads&utm_campaign=China_CN_Onclick_261103&utm_content=123&utm_medium=Onclick&click_id=abc789",
				hostname: "www.signalfast.cn",
				protocol: "https:",
			},
		});
		captureAdAttribution();
		expect(documentMock.cookie).toContain("Domain=signalfast.cn");
		expect(readAdAttribution()).toMatchObject({
			adPlatform: "propellerads",
			adClickId: "abc789",
			utmCampaign: "China_CN_Onclick_261103",
		});
	});
	it("does not share cookies across public tunnel users", () => {
		const documentMock = { cookie: "" };
		vi.stubGlobal("document", documentMock);
		vi.stubGlobal("localStorage", { setItem: vi.fn() });
		vi.stubGlobal("window", {
			location: {
				search: "?click_id=abc&utm_source=propellerads",
				hostname: "example.ngrok-free.dev",
				protocol: "https:",
			},
		});
		captureAdAttribution();
		expect(documentMock.cookie).not.toContain("Domain=");
	});
});
