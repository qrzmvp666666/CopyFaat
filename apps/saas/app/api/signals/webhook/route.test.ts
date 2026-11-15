import { SignalSourceError } from "@signals/lib/signal-source-error";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	save: vi.fn(),
	publish: vi.fn(),
	createLog: vi.fn(),
	completeLog: vi.fn(),
}));
vi.mock("@signals/lib/signal-store", () => ({ upsertStoredSignal: mocks.save }));
vi.mock("@signals/lib/signal-events", () => ({ publishSignalEvent: mocks.publish }));
vi.mock("@repo/database", () => ({
	createSignalWebhookLog: mocks.createLog,
	completeSignalWebhookLog: mocks.completeLog,
}));
vi.mock("@repo/logs", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
import { POST } from "./route";

const payload = {
	eventId: "test-open-1",
	symbol: "BTCUSDT",
	direction: "long",
	entry: 100,
	stopLoss: 90,
	source: { name: "飞扬" },
};
function request(body: unknown, secret?: string) {
	return new Request("http://localhost/api/signals/webhook", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(secret ? { "x-signal-webhook-secret": secret } : {}),
		},
		body: JSON.stringify(body),
	});
}
afterEach(() => {
	vi.resetAllMocks();
	vi.unstubAllEnvs();
});
describe("signal webhook route", () => {
	it("persists partial results with a request identifier and no private headers", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "test-secret");
		mocks.save.mockResolvedValue({ ...payload, id: "stored-1" });
		const response = await POST(
			request({ signals: [payload, { ...payload, stopLoss: 110 }] }, "test-secret"),
		);
		const body = await response.json();
		expect(body.logId).toMatch(/^[a-f0-9-]{36}$/);
		expect(body.logStatus).toBe("recorded");
		expect(mocks.createLog).toHaveBeenCalledWith(
			expect.objectContaining({ id: body.logId, mode: "batch", total: 2 }),
		);
		expect(mocks.completeLog).toHaveBeenCalledWith(
			body.logId,
			expect.objectContaining({ status: "partial", saved: 1, invalid: 1, httpStatus: 207 }),
		);
		expect(JSON.stringify(mocks.createLog.mock.calls)).not.toContain("test-secret");
	});
	it("does not process signals when an audit record cannot be created", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
		mocks.createLog.mockRejectedValueOnce(new Error("database unavailable"));
		const response = await POST(request(payload));
		expect(response.status).toBe(503);
		expect(mocks.save).not.toHaveBeenCalled();
	});
	it("preserves saved results if finishing the log fails", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
		mocks.save.mockResolvedValue({ ...payload, id: "stored-1" });
		mocks.completeLog.mockRejectedValueOnce(new Error("database unavailable"));
		const response = await POST(request(payload));
		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			ok: true,
			logStatus: "unavailable",
			signal: { id: "stored-1" },
		});
	});
	it("records malformed JSON without storing the raw request", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
		const response = await POST(
			new Request("http://localhost/api/signals/webhook", {
				method: "POST",
				body: "{secret:private}",
			}),
		);
		expect(response.status).toBe(400);
		expect(mocks.completeLog).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ status: "rejected", httpStatus: 400, items: [] }),
		);
		expect(JSON.stringify(mocks.createLog.mock.calls)).not.toContain("private");
	});
	it("checks authorization before processing a batch", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "test-secret");
		expect((await POST(request([payload]))).status).toBe(401);
		expect(mocks.save).not.toHaveBeenCalled();
	});
	it.each([[], Array(101).fill(payload), { signals: "invalid" }])(
		"rejects invalid batch envelopes before writing",
		async (body) => {
			vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
			expect((await POST(request(body))).status).toBe(422);
			expect(mocks.save).not.toHaveBeenCalled();
		},
	);
	it.each([[payload], { signals: [payload] }])(
		"accepts either batch envelope with authentication",
		async (body) => {
			vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "test-secret");
			mocks.save.mockResolvedValue({ ...payload, id: "stored-1" });
			const response = await POST(request(body, "test-secret"));
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				ok: true,
				total: 1,
				saved: 1,
				results: [{ status: "saved", signal: { id: "stored-1" } }],
			});
		},
	);
	it("returns 207 for partial failure and still saves the valid item", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
		mocks.save.mockResolvedValue({ ...payload, id: "stored-1" });
		const response = await POST(request({ signals: [null, payload] }));
		expect(response.status).toBe(207);
		expect(await response.json()).toMatchObject({ ok: false, saved: 1, invalid: 1 });
	});
	it("preserves single-signal responses", async () => {
		vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
		mocks.save
			.mockResolvedValueOnce({ ...payload, id: "stored-1" })
			.mockResolvedValueOnce(null);
		const saved = await POST(request(payload));
		expect(saved.status).toBe(201);
		expect(await saved.json()).toMatchObject({ ok: true, signal: { id: "stored-1" } });
		const ignored = await POST(request(payload));
		expect(ignored.status).toBe(202);
		expect(await ignored.json()).toMatchObject({ ok: true, ignored: true });
	});
});

it("reports binding errors as actionable 422 responses and logs the source code", async () => {
	vi.stubEnv("SIGNAL_WEBHOOK_SECRET", "");
	mocks.save.mockRejectedValueOnce(
		new SignalSourceError("SOURCE_UNBOUND", "Configure the source binding."),
	);
	const response = await POST(
		request({
			...payload,
			source: {
				name: "三马哥合约",
				platform: "discord",
				serverName: "server",
				channelName: "channel",
			},
		}),
	);
	expect(response.status).toBe(422);
	expect(await response.json()).toMatchObject({ code: "SOURCE_UNBOUND", logStatus: "recorded" });
	expect(mocks.completeLog).toHaveBeenCalledWith(
		expect.any(String),
		expect.objectContaining({
			invalid: 1,
			items: [
				expect.objectContaining({
					code: "SOURCE_UNBOUND",
					input: expect.objectContaining({
						serverName: "server",
						channelName: "channel",
					}),
				}),
			],
		}),
	);
});
