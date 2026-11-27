import { describe, expect, it } from "vitest";

import { resolveChannelRegion } from "../src/main/discovery/region";

const window = { x: -1200, y: 30, width: 1100, height: 800 };
const bounds = { x: -1120, y: 110, width: 240, height: 690 };
const sidebar = {
	content: { role: "list", name: "频道" },
	presentation: { bounds, has_bounds: true },
};

describe("automatic sidebar positioning", () => {
	it("locates the sidebar inside an entire window on a secondary display", () => {
		expect(resolveChannelRegion(window, window, [sidebar])).toEqual(bounds);
	});
	it("clips scrolling to the selected scope and actual sidebar", () => {
		expect(
			resolveChannelRegion({ x: -1150, y: 200, width: 900, height: 400 }, window, [sidebar]),
		).toEqual({ x: -1120, y: 200, width: 240, height: 400 });
	});
	it("does not scroll the message pane when the scope excludes the sidebar", () => {
		expect(() =>
			resolveChannelRegion({ x: -800, y: 110, width: 600, height: 600 }, window, [sidebar]),
		).toThrow("未包含频道侧栏");
	});
	it("rejects missing, ambiguous, or hidden sidebars", () => {
		for (const nodes of [
			[],
			[sidebar, sidebar],
			[{ ...sidebar, presentation: { bounds, has_bounds: false } }],
		])
			expect(() => resolveChannelRegion(window, window, nodes)).toThrow("无法唯一定位");
	});
	it("supports the English accessibility label", () => {
		expect(
			resolveChannelRegion(window, window, [
				{ ...sidebar, content: { role: "list", name: "Channels" } },
			]),
		).toEqual(bounds);
	});
});
