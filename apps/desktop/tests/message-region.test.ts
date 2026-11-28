import { describe, expect, it } from "vitest";

import { resolveMessageRegion } from "../src/main/discovery/region";

const window = { x: 100, y: 100, width: 1000, height: 700 };
function list(name: string, bounds = { x: 400, y: 150, width: 900, height: 800 }) {
	return { content: { role: "list", name }, presentation: { has_bounds: true, bounds } };
}

describe("Discord message scroll region", () => {
	it.each(["updates中的消息", "Messages in updates"])(
		"clips %s to the visible window",
		(name) => {
			expect(resolveMessageRegion(window, [list("Channels"), list(name)], "updates")).toEqual(
				{
					x: 400,
					y: 150,
					width: 700,
					height: 650,
				},
			);
		},
	);
	it("rejects ambiguous lists even when only one exposes bounds", () => {
		const hidden = list("updates中的消息");
		hidden.presentation.has_bounds = false;
		expect(() =>
			resolveMessageRegion(window, [hidden, list("Messages in updates")], "updates"),
		).toThrow("无法安全定位");
	});
	it("rejects missing bounds without using the sidebar", () => {
		const hidden = list("updates中的消息");
		hidden.presentation.has_bounds = false;
		expect(() => resolveMessageRegion(window, [hidden, list("Channels")], "updates")).toThrow(
			"无法安全定位",
		);
	});
	it.each([
		{ x: 2000, y: 2000, width: 600, height: 400 },
		{ x: NaN, y: 150, width: 600, height: 400 },
		{ x: 400, y: 150, width: 0, height: 400 },
	])("rejects unusable coordinates %j", (bounds) => {
		expect(() =>
			resolveMessageRegion(window, [list("updates中的消息", bounds)], "updates"),
		).toThrow();
	});
});
