import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn() }));
vi.mock("@repo/database", () => ({ db: { adConversion: mocks } }));
import {
	getPropellerAdsPostbackUrl,
	reportAdConversion,
} from "../../../../../packages/payments/lib/ad-conversions";

beforeEach(() => {
	vi.resetAllMocks();
	vi.unstubAllGlobals();
});
const input = {
	provider: "stripe",
	paymentId: "cs_test",
	attributionId: "sf_test",
	adPlatform: "propellerads",
	adClickId: "abc789",
	amountMinor: 899,
	currency: "usd",
};
describe("PropellerAds delivery", () => {
	it("replaces only click ID and actual paid dollars", () => {
		expect(getPropellerAdsPostbackUrl("abc789", 899, "usd")).toBe(
			"https://ad.propellerads.com/conversion.php?aid=3929518&pid=&tid=160672&visitor_id=abc789&payout=8.99&goal=1",
		);
		expect(getPropellerAdsPostbackUrl("a&b", 4999, "USD")).toContain(
			"visitor_id=a%26b&payout=49.99",
		);
	});
	it("rejects guessed exchange rates, zero trials, invalid money and macros", () => {
		for (const [amount, currency] of [
			[899, "eur"],
			[0, "usd"],
			[8.99, "usd"],
		] as const)
			expect(getPropellerAdsPostbackUrl("abc", amount, currency)).toBeNull();
		expect(getPropellerAdsPostbackUrl("${SUBID}", 899, "usd")).toBeNull();
	});
	it("never resends a successful conversion", async () => {
		mocks.upsert.mockResolvedValue({ id: "conv", status: "sent" });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await reportAdConversion(input);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("claims a delivery lease and records success", async () => {
		mocks.upsert.mockResolvedValue({ id: "conv", status: "pending" });
		mocks.updateMany.mockResolvedValue({ count: 1 });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("OK")));
		await reportAdConversion(input);
		expect(mocks.update).toHaveBeenCalledWith({
			where: { id: "conv" },
			data: { status: "sent" },
		});
	});
	it("records failure and requests a webhook retry", async () => {
		mocks.upsert.mockResolvedValue({ id: "conv", status: "pending" });
		mocks.updateMany.mockResolvedValue({ count: 1 });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failed", { status: 500 })));
		await expect(reportAdConversion(input)).rejects.toThrow("retry webhook");
		expect(mocks.update.mock.calls[0][0].data.status).toBe("failed");
	});
	it("does not deliver concurrently or for other advertisers", async () => {
		mocks.upsert.mockResolvedValue({ id: "conv", status: "sending" });
		mocks.updateMany.mockResolvedValue({ count: 0 });
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(reportAdConversion(input)).rejects.toThrow("in progress");
		await reportAdConversion({ ...input, adPlatform: "other" });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
