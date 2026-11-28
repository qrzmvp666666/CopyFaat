import { describe, expect, it } from "vitest";

import { parseDesktopWorkerResponse } from "../src/main/worker-protocol";

describe("desktop worker message protocol", () => {
	it("accepts the direct payload emitted by Electron utilityProcess", () => {
		const result = { version: 1, messages: [], channels: [] };

		expect(parseDesktopWorkerResponse({ type: "result", result })).toEqual({
			type: "result",
			result,
		});
	});

	it("validates channel progress and optional screen coordinates", () => {
		const channel = {
			channelId: "123",
			channelName: "news",
			index: 1,
			total: 3,
			status: "scanning",
			bounds: { x: -100, y: 50, width: 200, height: 40 },
		};
		expect(parseDesktopWorkerResponse({ type: "progress", channel })).toEqual({
			type: "progress",
			channel,
		});
		expect(
			parseDesktopWorkerResponse({ type: "progress", channel: { ...channel, index: 4 } }),
		).toBeUndefined();
		expect(
			parseDesktopWorkerResponse({
				type: "progress",
				channel: { ...channel, bounds: { ...channel.bounds, width: -1 } },
			}),
		).toBeUndefined();
	});

	it("preserves worker errors", () => {
		expect(parseDesktopWorkerResponse({ type: "error", message: "Discord 不可用" })).toEqual({
			type: "error",
			message: "Discord 不可用",
		});
	});

	it("rejects malformed and unknown messages without throwing", () => {
		expect(parseDesktopWorkerResponse(undefined)).toBeUndefined();
		expect(parseDesktopWorkerResponse({ data: { type: "result" } })).toBeUndefined();
		expect(parseDesktopWorkerResponse({ type: "progress" })).toBeUndefined();
	});
});
