import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

const { syncMembershipAnalyticsProfileMock } = vi.hoisted(() => ({
	syncMembershipAnalyticsProfileMock: vi.fn(),
}));

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
		},
	},
}));

vi.mock("@repo/payments/lib/mixpanel", () => ({
	syncMembershipAnalyticsProfile: syncMembershipAnalyticsProfileMock,
}));

import { auth } from "@repo/auth";

import { syncMembershipProfile } from "./sync-membership-profile";

describe("syncMembershipProfile", () => {
	it("synchronizes only the authenticated user", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue({
			session: { id: "session_1", userId: "user_1" },
			user: { id: "user_1", role: "user" },
		} as never);

		const result = await call(syncMembershipProfile, undefined, {
			context: { headers: new Headers() },
		});

		expect(result).toEqual({ ok: true });
		expect(syncMembershipAnalyticsProfileMock).toHaveBeenCalledWith("user_1");
	});
});
