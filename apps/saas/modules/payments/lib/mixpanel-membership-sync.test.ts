import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { databaseMock, loggerMock } = vi.hoisted(() => ({
	databaseMock: {
		getEntitlementGrantsByUserId: vi.fn(),
		getPurchasesByUserId: vi.fn(),
		getUserById: vi.fn(),
	},
	loggerMock: {
		warn: vi.fn(),
	},
}));

vi.mock("@repo/database", () => databaseMock);
vi.mock("@repo/logs", () => ({ logger: loggerMock }));

describe("Mixpanel membership synchronization", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.stubEnv("MIXPANEL_API_HOST", "https://api-eu.mixpanel.com");
		vi.stubEnv("MIXPANEL_TOKEN", "server-token");
		databaseMock.getUserById.mockResolvedValue({
			email: "member@example.com",
			id: "user_1",
			name: "会员用户",
		});
		databaseMock.getPurchasesByUserId.mockResolvedValue([]);
		databaseMock.getEntitlementGrantsByUserId.mockResolvedValue([
			{
				durationDays: 2,
				expiresAt: new Date("2026-07-13T00:00:00.000Z"),
				id: "grant_1",
				planId: "pro",
				source: "signup_trial",
				startsAt: new Date("2026-07-11T00:00:00.000Z"),
				userId: "user_1",
			},
		]);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("sends only the approved profile fields to Mixpanel EU", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fetchMock);
		const { syncMembershipAnalyticsProfile } = await import("@repo/payments/lib/mixpanel");

		await syncMembershipAnalyticsProfile("user_1");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		const payload = JSON.parse((options.body as URLSearchParams).get("data") ?? "{}") as {
			$set: Record<string, unknown>;
			$set_once: Record<string, unknown>;
			$token: string;
		};

		expect(url).toBe("https://api-eu.mixpanel.com/engage?verbose=1");
		expect(payload.$token).toBe("server-token");
		expect(payload.$set).toEqual({
			$email: "member@example.com",
			$name: "会员用户",
			access_expires_at: "2026-07-13T00:00:00.000Z",
			billing_type: "entitlement",
			membership_status: "trial",
			plan_id: "pro",
			subscription_status: "none",
			trial_expires_at: "2026-07-13T00:00:00.000Z",
		});
		expect(payload.$set_once).toBeUndefined();
		expect(payload.$set).not.toHaveProperty("customerId");
		expect(payload.$set).not.toHaveProperty("priceId");
		expect(payload.$set).not.toHaveProperty("subscriptionId");
	});

	it("does not make a request without a configured Mixpanel token", async () => {
		vi.stubEnv("MIXPANEL_TOKEN", "");
		vi.stubEnv("NEXT_PUBLIC_MIXPANEL_TOKEN", "");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { syncMembershipAnalyticsProfile } = await import("@repo/payments/lib/mixpanel");

		await syncMembershipAnalyticsProfile("user_1");

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps backfilled membership events idempotent and historically timed", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		vi.stubGlobal("fetch", fetchMock);
		const { MEMBERSHIP_ANALYTICS_EVENTS, recordMembershipAnalyticsEvent } =
			await import("@repo/payments/lib/mixpanel");

		await recordMembershipAnalyticsEvent("user_1", MEMBERSHIP_ANALYTICS_EVENTS.TRIAL_STARTED, {
			insertId: "signup-trial:grant_1",
			occurredAt: new Date("2026-07-11T00:00:00.000Z"),
		});

		const trackCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/track?"));
		expect(trackCall).toBeDefined();
		const payload = JSON.parse(
			(trackCall?.[1].body as URLSearchParams).get("data") ?? "[]",
		) as {
			properties: Record<string, unknown>;
		}[];

		expect(payload).toEqual([
			{
				event: "membership_trial_started",
				properties: {
					$insert_id: "signup-trial:grant_1",
					$time: 1783728000,
					$token: "server-token",
					billing_type: "entitlement",
					distinct_id: "user_1",
					membership_status: "trial",
					plan_id: "pro",
				},
			},
		]);
	});
});
