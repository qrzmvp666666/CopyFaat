import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	upsert: vi.fn(),
	updateMany: vi.fn(),
	update: vi.fn(),
	findFirst: vi.fn(),
	firstPayment: vi.fn(),
}));
vi.mock("@repo/database", () => ({
	db: { adConversion: mocks },
	recordFirstSubscriptionPayment: mocks.firstPayment,
}));
import {
	getPropellerAdsPostbackUrl,
	getAdsgramPostbackUrl,
	reportAdConversion,
} from "../../../../../packages/payments/lib/ad-conversions";

beforeEach(() => {
	vi.resetAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	mocks.firstPayment.mockResolvedValue(true);
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
		mocks.upsert.mockResolvedValue({
			id: "conv",
			status: "pending",
			amountMinor: 899,
			currency: "usd",
		});
		mocks.updateMany.mockResolvedValue({ count: 1 });
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("OK")));
		await reportAdConversion(input);
		expect(mocks.update).toHaveBeenCalledWith({
			where: { id: "conv" },
			data: { status: "sent" },
		});
	});
	it("records failure and requests a webhook retry", async () => {
		mocks.upsert.mockResolvedValue({
			id: "conv",
			status: "pending",
			amountMinor: 899,
			currency: "usd",
		});
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

const adsgramInput = {
	...input,
	adPlatform: "adsgram",
	adRecord: "R001",
	subscriptionId: "sub_test",
	adClickId: undefined,
};
function mockAdsgramTask(status = "pending") {
	mocks.upsert.mockResolvedValue({
		id: "conv",
		status,
		adPlatform: "adsgram",
		adRecord: "R001",
		amountMinor: 899,
		currency: "usd",
	});
	mocks.updateMany.mockResolvedValue({ count: 1 });
	const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
	vi.stubGlobal("fetch", fetchMock);
	vi.stubEnv("ADSGRAM_CONVERSION_TOKEN", "private-test-token");
	return fetchMock;
}
describe("AdsGram first paid subscription delivery", () => {
	it("uses the official first-purchase goal and encodes opaque record values", () => {
		const url = new URL(getAdsgramPostbackUrl("R+a&b=", "secret")!);
		expect(url.origin + url.pathname).toBe("https://api.adsgram.ai/confirm_conversion");
		expect(url.searchParams.get("record")).toBe("R+a&b=");
		expect(url.searchParams.get("goaltype")).toBe("2");
		expect(url.searchParams.get("token")).toBe("secret");
		expect(getAdsgramPostbackUrl("${record_data}", "secret")).toBeNull();
		expect(getAdsgramPostbackUrl("{record_data}", "secret")).toBeNull();
	});
	it("delivers without click_id, preserving record and subscription on the task", async () => {
		const fetchMock = mockAdsgramTask();
		await reportAdConversion(adsgramInput);
		expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({
			adPlatform: "adsgram",
			adRecord: "R001",
			subscriptionId: "sub_test",
			goal: "first_purchase",
			amountMinor: 899,
		});
		expect(mocks.firstPayment).toHaveBeenCalledWith("stripe", "sub_test", "cs_test");
		expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("record")).toBe("R001");
		expect(mocks.update).toHaveBeenCalledWith({
			where: { id: "conv" },
			data: { status: "sent" },
		});
	});
	it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
		"does not convert trials or invalid amounts (%s)",
		async (amountMinor) => {
			const fetchMock = mockAdsgramTask();
			await reportAdConversion({ ...adsgramInput, amountMinor });
			expect(mocks.firstPayment).not.toHaveBeenCalled();
			expect(mocks.upsert).not.toHaveBeenCalled();
			expect(fetchMock).not.toHaveBeenCalled();
		},
	);
	it("does not impose PropellerAds' USD restriction or invent a USD amount", async () => {
		mockAdsgramTask();
		await reportAdConversion({ ...adsgramInput, currency: "eur" });
		expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({
			currency: "eur",
			amountUsd: null,
		});
	});
	it("records the first paid event even without attribution, preventing conversion on a later renewal", async () => {
		mockAdsgramTask();
		await reportAdConversion({ ...adsgramInput, attributionId: null });
		expect(mocks.firstPayment).toHaveBeenCalledOnce();
		expect(mocks.upsert).not.toHaveBeenCalled();
		mocks.firstPayment.mockResolvedValue(false);
		await reportAdConversion({ ...adsgramInput, paymentId: "in_renewal" });
		expect(mocks.upsert).not.toHaveBeenCalled();
	});
	it("never sends on renewal and retries of renewal", async () => {
		const fetchMock = mockAdsgramTask();
		mocks.firstPayment.mockResolvedValue(false);
		await reportAdConversion({ ...adsgramInput, paymentId: "in_renewal" });
		await reportAdConversion({ ...adsgramInput, paymentId: "in_renewal" });
		expect(mocks.upsert).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("does not report a one-time checkout as a subscription acquisition", async () => {
		const fetchMock = mockAdsgramTask();
		await reportAdConversion({ ...adsgramInput, subscriptionId: undefined });
		expect(mocks.upsert).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("skips invalid macros and missing records", async () => {
		const fetchMock = mockAdsgramTask();
		for (const adRecord of [undefined, "", "  ", "${record_data}", "{record_data}"]) {
			await reportAdConversion({ ...adsgramInput, adRecord });
		}
		expect(mocks.upsert).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("stores a failed task for a missing token and retries the same task after configuration", async () => {
		const fetchMock = mockAdsgramTask();
		vi.stubEnv("ADSGRAM_CONVERSION_TOKEN", "");
		await expect(reportAdConversion(adsgramInput)).rejects.toThrow("retry webhook");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(mocks.update.mock.calls[0][0].data.status).toBe("failed");
		vi.stubEnv("ADSGRAM_CONVERSION_TOKEN", "private-test-token");
		await reportAdConversion(adsgramInput);
		expect(fetchMock).toHaveBeenCalledOnce();
	});
	it("does not persist token-bearing network errors", async () => {
		const fetchMock = mockAdsgramTask();
		fetchMock.mockRejectedValue(new Error("https://api.adsgram.ai/?token=private-test-token"));
		await expect(reportAdConversion(adsgramInput)).rejects.toThrow("retry webhook");
		expect(JSON.stringify(mocks.update.mock.calls)).not.toContain("private-test-token");
	});
	it("skips successful duplicates across snapshots, subscriptions and payment providers", async () => {
		const fetchMock = mockAdsgramTask();
		mocks.upsert.mockRejectedValue({ code: "P2002" });
		mocks.findFirst.mockResolvedValue({ id: "original", status: "sent" });
		await reportAdConversion({
			...adsgramInput,
			provider: "yolfi",
			attributionId: "sf_new",
			subscriptionId: "sub_new",
			paymentId: "in_new",
		});
		expect(mocks.findFirst.mock.calls[0][0].where.OR).toContainEqual({
			adPlatform: "adsgram",
			adRecord: "R001",
			goal: "first_purchase",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("retries a failed duplicate using the original task's payload", async () => {
		const fetchMock = mockAdsgramTask();
		mocks.upsert.mockRejectedValue({ code: "P2002" });
		mocks.findFirst.mockResolvedValue({
			id: "original",
			status: "failed",
			adPlatform: "adsgram",
			adRecord: "original-record",
		});
		await reportAdConversion(adsgramInput);
		expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("record")).toBe(
			"original-record",
		);
		expect(mocks.update.mock.calls[0][0].where.id).toBe("original");
	});
	it("does not swallow database failures", async () => {
		mockAdsgramTask();
		mocks.upsert.mockRejectedValue(new Error("database unavailable"));
		await expect(reportAdConversion(adsgramInput)).rejects.toThrow("database unavailable");
	});
});
