import { describe, expect, it, vi } from "vitest";
vi.mock("@repo/database", () => ({
	createSignalWebhookLog: vi.fn(),
	completeSignalWebhookLog: vi.fn(),
}));
vi.mock("@repo/logs", () => ({ logger: { error: vi.fn() } }));
import { getWebhookAuditItems, getWebhookAuditErrors } from "./signal-webhook-audit";

describe("signal webhook audit sanitization", () => {
	it("only keeps bounded signal fields and source identity", () => {
		const items = getWebhookAuditItems([
			{
				eventId: "open-1",
				symbol: "BTCUSDT",
				source: { name: "trader", platform: "discord", secret: "private" },
				secret: "private",
				note: "a".repeat(10000),
				password: "private",
			},
			null,
		]);
		expect(items[0]).toMatchObject({
			index: 0,
			eventId: "open-1",
			status: "pending",
			input: { sourceName: "trader", platform: "discord" },
		});
		expect(items[0].input.note).toHaveLength(500);
		expect(JSON.stringify(items)).not.toContain("private");
		expect(items[1]).toMatchObject({ index: 1, input: {}, errors: [] });
	});
	it("retains field names when flattening validation issues", () => {
		expect(
			getWebhookAuditErrors({
				formErrors: ["Invalid signal"],
				fieldErrors: { stopLoss: ["Required"] },
			}),
		).toEqual(["Invalid signal", "stopLoss: Required"]);
	});
});
