import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCheckoutAttribution } = vi.hoisted(() => ({
	createCheckoutAttribution: vi.fn(),
}));

vi.mock("@repo/database", () => ({ createCheckoutAttribution }));

import { POST } from "./route";

beforeEach(() => {
	vi.resetAllMocks();
	createCheckoutAttribution.mockResolvedValue(undefined);
});

function createRequest(origin: string, forwarded = true) {
	return new Request("http://0.0.0.0:4100/api/payments/attribution", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			host: "0.0.0.0:4100",
			origin,
			...(forwarded
				? {
						"x-forwarded-host": "unwandering-paradisaical-marietta.ngrok-free.dev",
						"x-forwarded-proto": "https",
					}
				: {}),
		},
		body: JSON.stringify({
			provider: "stripe",
			paymentLinkUrl: "https://buy.stripe.com/test",
			adPlatform: "propellerads",
			adClickId: "abc789",
		}),
	});
}

describe("POST /api/payments/attribution", () => {
	it("accepts the public origin forwarded by the HTTPS tunnel", async () => {
		const response = await POST(
			createRequest("https://unwandering-paradisaical-marietta.ngrok-free.dev"),
		);

		expect(response.status).toBe(200);
		expect(createCheckoutAttribution).toHaveBeenCalledWith(
			expect.objectContaining({ adClickId: "abc789", provider: "stripe" }),
		);
	});

	it("rejects a cross-origin request without writing a record", async () => {
		const response = await POST(createRequest("https://attacker.example", false));

		expect(response.status).toBe(403);
		expect(createCheckoutAttribution).not.toHaveBeenCalled();
	});
});
