import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mixpanelMock } = vi.hoisted(() => ({
	mixpanelMock: {
		clear_opt_in_out_tracking: vi.fn(),
		get_distinct_id: vi.fn(),
		identify: vi.fn(),
		init: vi.fn(),
		people: {
			set: vi.fn(),
		},
		reset: vi.fn(),
		track: vi.fn(),
	},
}));

vi.mock("mixpanel-browser", () => ({
	default: mixpanelMock,
}));

describe("analytics", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		vi.stubEnv("NEXT_PUBLIC_MIXPANEL_API_HOST", "https://api-eu.mixpanel.com");
		vi.stubEnv("NEXT_PUBLIC_MIXPANEL_TOKEN", "test-token");
		mixpanelMock.get_distinct_id.mockReturnValue("$device:test-device");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("initializes automatically and tracks without a consent gate", async () => {
		const { ANALYTICS_EVENTS, trackAnalyticsEvent } = await import("./analytics");

		trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_FORM_VIEWED);
		trackAnalyticsEvent(ANALYTICS_EVENTS.SIGNUP_SUBMITTED, { method: "password" });

		expect(mixpanelMock.init).toHaveBeenCalledTimes(1);
		expect(mixpanelMock.clear_opt_in_out_tracking).toHaveBeenCalledTimes(1);
		expect(mixpanelMock.track).toHaveBeenNthCalledWith(1, "signup_form_viewed", undefined);
		expect(mixpanelMock.track).toHaveBeenNthCalledWith(2, "signup_submitted", {
			method: "password",
		});
	});

	it("aliases a new account to the anonymous device before identifying it", async () => {
		const { identifyNewAnalyticsUser } = await import("./analytics");

		identifyNewAnalyticsUser({
			email: "test@example.com",
			id: "user-1",
			name: "测试用户",
		});

		expect(mixpanelMock.track).toHaveBeenCalledWith(
			"$create_alias",
			{
				alias: "user-1",
				distinct_id: "$device:test-device",
			},
			{ send_immediately: true },
		);
		expect(mixpanelMock.identify).toHaveBeenCalledWith("user-1");
		expect(mixpanelMock.people.set).toHaveBeenCalledWith({
			$email: "test@example.com",
			$name: "测试用户",
		});
	});

	it("keeps the pending social signup method independently of Mixpanel state", async () => {
		const sessionStorage = {
			getItem: vi.fn().mockReturnValue("google"),
			removeItem: vi.fn(),
			setItem: vi.fn(),
		};
		vi.stubGlobal("window", { sessionStorage });
		const { consumePendingSignupMethod, rememberPendingSignupMethod } =
			await import("./analytics");

		rememberPendingSignupMethod("google");
		expect(consumePendingSignupMethod()).toBe("google");
		expect(sessionStorage.setItem).toHaveBeenCalledWith(
			"signalfast:analytics:pending-signup-method",
			"google",
		);
		expect(sessionStorage.removeItem).toHaveBeenCalledWith(
			"signalfast:analytics:pending-signup-method",
		);
	});
});
