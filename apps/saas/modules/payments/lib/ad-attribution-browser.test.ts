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

describe("AdsGram advertising context", () => {
	it("preserves the exact record across pages for 30 days and replaces it on a new advertising visit", () => {
		const documentMock = { cookie: "" };
		const storage = new Map<string, string>();
		vi.stubGlobal("document", documentMock);
		vi.stubGlobal("localStorage", {
			setItem: (key: string, value: string) => storage.set(key, value),
			getItem: (key: string) => storage.get(key),
		});
		const location = {
			search: "?utm_source=adsgram&click_id=C001&record=R%2B001%3D%3D&utm_campaign=china",
			hostname: "example.ngrok-free.dev",
			protocol: "https:",
		};
		vi.stubGlobal("window", { location });
		captureAdAttribution();
		expect(documentMock.cookie).toContain("Max-Age=2592000");
		expect(readAdAttribution()).toMatchObject({
			adPlatform: "adsgram",
			adRecord: "R+001==",
			adClickId: "C001",
		});
		location.search = "";
		captureAdAttribution();
		expect(readAdAttribution().adRecord).toBe("R+001==");
		documentMock.cookie = "";
		expect(readAdAttribution().adRecord).toBe("R+001==");
		location.search = "?utm_source=propellerads&click_id=C002";
		captureAdAttribution();
		expect(readAdAttribution().adRecord).toBeUndefined();
	});
	it("expires browser attribution without extending it on normal navigation", () => {
		const now = Date.now();
		vi.spyOn(Date, "now").mockReturnValue(now);
		vi.stubGlobal("document", { cookie: "" });
		vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn() });
		const location = {
			search: "?utm_source=adsgram&record=R001",
			hostname: "example.com",
			protocol: "https:",
		};
		vi.stubGlobal("window", { location });
		captureAdAttribution();
		location.search = "";
		vi.spyOn(Date, "now").mockReturnValue(now + 31 * 86400000);
		captureAdAttribution();
		expect(readAdAttribution()).toEqual({});
		vi.restoreAllMocks();
	});
});
