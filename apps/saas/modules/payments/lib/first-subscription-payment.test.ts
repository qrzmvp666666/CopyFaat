import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), findUnique: vi.fn() }));
vi.mock("../../../../../packages/database/prisma/client", () => ({ db: { purchase: mocks } }));
import { recordFirstSubscriptionPayment } from "../../../../../packages/database/prisma/queries/checkout-attribution";

beforeEach(() => vi.resetAllMocks());

describe("first subscription payment marker", () => {
	it("atomically chooses the first payment and permits retries of only that payment", async () => {
		let firstPaidPaymentId: string | null = null;
		mocks.updateMany.mockImplementation(async ({ data }) => {
			if (firstPaidPaymentId !== null) return { count: 0 };
			firstPaidPaymentId = data.firstPaidPaymentId;
			return { count: 1 };
		});
		mocks.findUnique.mockImplementation(async () => ({
			provider: "stripe",
			firstPaidPaymentId,
		}));
		expect(await recordFirstSubscriptionPayment("stripe", "sub_test", "in_first")).toBe(true);
		expect(await recordFirstSubscriptionPayment("stripe", "sub_test", "in_first")).toBe(true);
		expect(await recordFirstSubscriptionPayment("stripe", "sub_test", "in_renewal")).toBe(
			false,
		);
		expect(firstPaidPaymentId).toBe("in_first");
		expect(mocks.updateMany.mock.calls[0][0].where).toEqual({
			provider: "stripe",
			subscriptionId: "sub_test",
			firstPaidPaymentId: null,
		});
	});
	it("requests retry if checkout purchase has not arrived yet", async () => {
		mocks.findUnique.mockResolvedValue(null);
		await expect(
			recordFirstSubscriptionPayment("stripe", "sub_test", "in_first"),
		).rejects.toThrow("retry webhook");
	});
	it("does not relabel pre-existing paid subscriptions on renewal", async () => {
		mocks.findUnique.mockResolvedValue({
			provider: "stripe",
			firstPaidPaymentId: "legacy_before_adsgram",
		});
		expect(await recordFirstSubscriptionPayment("stripe", "sub_test", "in_renewal")).toBe(
			false,
		);
	});
});
