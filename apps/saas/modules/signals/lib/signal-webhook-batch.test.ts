import { describe, expect, it, vi } from "vitest";

import { SignalSourceError } from "./signal-source-error";
import type { StoredSignal } from "./signal-types";
import { processSignalWebhookBatch } from "./signal-webhook-batch";

const payload = {
	eventId: "open-1",
	symbol: "BTCUSDT",
	direction: "long",
	entry: 100,
	stopLoss: 90,
	source: { name: "飞扬", platform: "discord" },
};
const signal = { ...payload, id: "signal-1" } as StoredSignal;

describe("processSignalWebhookBatch", () => {
	it("reports mixed results and continues after validation and database failures", async () => {
		const save = vi
			.fn()
			.mockResolvedValueOnce(signal)
			.mockRejectedValueOnce(new Error("private connection details"))
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(signal);
		const publish = vi.fn();
		const result = await processSignalWebhookBatch(
			[payload, { ...payload, stopLoss: 110 }, payload, payload, payload],
			{ save, publish },
		);
		expect(result).toMatchObject({
			ok: false,
			total: 5,
			saved: 2,
			invalid: 1,
			failed: 1,
			ignored: 1,
		});
		expect(result.results.map((item) => item.status)).toEqual([
			"saved",
			"invalid",
			"failed",
			"ignored",
			"saved",
		]);
		expect(result.results.map((item) => item.index)).toEqual([0, 1, 2, 3, 4]);
		expect(result.results[1].issues).toBeDefined();
		expect(JSON.stringify(result)).not.toContain("private connection details");
		expect(publish).toHaveBeenCalledTimes(2);
	});
	it("awaits earlier updates before saving later items for the same event", async () => {
		const order: string[] = [];
		const save = vi.fn(async (input) => {
			order.push(`start:${input.status}`);
			await Promise.resolve();
			order.push(`finish:${input.status}`);
			return signal;
		});
		const result = await processSignalWebhookBatch(
			[
				{ ...payload, status: "active" },
				{ ...payload, status: "history" },
			],
			{ save, publish: vi.fn() },
		);
		expect(order).toEqual(["start:active", "finish:active", "start:history", "finish:history"]);
		expect(result.ok).toBe(true);
	});
	it("keeps saved results when a notification listener throws", async () => {
		const result = await processSignalWebhookBatch([payload, payload], {
			save: vi.fn().mockResolvedValue(signal),
			publish: () => {
				throw new Error("listener failed");
			},
		});
		expect(result).toMatchObject({ ok: true, saved: 2, failed: 0 });
	});
	it("rejects non-object entries individually", async () => {
		const save = vi.fn();
		const result = await processSignalWebhookBatch([null, [], "text"], {
			save,
			publish: vi.fn(),
		});
		expect(result).toMatchObject({ ok: false, invalid: 3 });
		expect(save).not.toHaveBeenCalled();
	});
});

it("returns source problems individually and continues saving the next item", async () => {
	const save = vi
		.fn()
		.mockRejectedValueOnce(new SignalSourceError("SOURCE_UNBOUND", "Source is not bound."))
		.mockResolvedValueOnce(signal);
	const result = await processSignalWebhookBatch([payload, { ...payload, eventId: "next" }], {
		save,
		publish: vi.fn(),
	});
	expect(result).toMatchObject({ saved: 1, invalid: 1, failed: 0 });
	expect(result.results[0]).toMatchObject({ status: "invalid", code: "SOURCE_UNBOUND" });
	expect(result.results[1].status).toBe("saved");
});
