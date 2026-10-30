import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	getUnexpiredEntitlementGrantsByUserId: vi.fn(),
}));
vi.mock("@auth/lib/server", () => ({ getSession: mocks.getSession }));
vi.mock("@repo/database", () => ({
	getPurchasesByUserId: mocks.getPurchasesByUserId,
	getUnexpiredEntitlementGrantsByUserId: mocks.getUnexpiredEntitlementGrantsByUserId,
}));

import { getCurrentSignalsAccess, SIGNALS_ACCESS } from "./access";

describe("current user's signals access", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.getPurchasesByUserId.mockResolvedValue([]);
		mocks.getUnexpiredEntitlementGrantsByUserId.mockResolvedValue([]);
	});

	it("requires an identified session even if purchases exist", async () => {
		mocks.getSession.mockResolvedValue(null);
		expect(await getCurrentSignalsAccess()).toBe(SIGNALS_ACCESS.unauthenticated);
		expect(mocks.getPurchasesByUserId).not.toHaveBeenCalled();
	});

	it("checks only the logged-in user's entitlements and denies no paid access", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "current-user" } });
		expect(await getCurrentSignalsAccess()).toBe(SIGNALS_ACCESS.forbidden);
		expect(mocks.getPurchasesByUserId).toHaveBeenCalledWith("current-user");
		expect(mocks.getUnexpiredEntitlementGrantsByUserId).toHaveBeenCalledWith("current-user");
	});

	it("allows the current user's valid paid redemption entitlement", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "current-user" } });
		mocks.getUnexpiredEntitlementGrantsByUserId.mockResolvedValue([
			{
				id: "paid-grant",
				userId: "current-user",
				planId: "pro",
				source: "redeem_code",
				startsAt: new Date(),
				expiresAt: new Date(Date.now() + 86_400_000),
				durationDays: 1,
			},
		]);
		expect(await getCurrentSignalsAccess()).toBe(SIGNALS_ACCESS.allowed);
	});
});
