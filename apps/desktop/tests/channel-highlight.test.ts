import { describe, expect, it } from "vitest";

import { resolveChannelHighlight } from "../src/main/discovery/channel-highlight";
import { relativeChannelHighlight } from "../src/main/task-activity-layout";

const windowBounds = { x: 100, y: 50, width: 1000, height: 700 };
function node(role: string, name: string, parent_index: number, y = 100) {
	return {
		content: { role, name },
		relation: { parent_index },
		presentation: {
			has_bounds: true,
			bounds: { x: 120, y, width: 250, height: role === "list" ? 500 : 40 },
		},
	};
}
const tree = [
	node("list", "Channels", -1),
	node("button", "One (category)", 0),
	node("link", "Unread, news (text channel)", 0, 150),
	node("button", "Two (category)", 0),
	node("link", "news (text channel)", 0, 250),
	node("link", "news (text channel)", -1, 350),
];

describe("channel row highlighting", () => {
	it("uses category and sidebar ancestry to disambiguate repeated channel names", () => {
		expect(
			resolveChannelHighlight(windowBounds, tree, { name: "news", category: "Two" }),
		).toEqual({ x: 120, y: 250, width: 250, height: 40 });
	});
	it("restores category order for native breadth-first trees with nested row wrappers", () => {
		const nested = [
			node("list", "Channels", -1),
			node("group", null as unknown as string, 0),
			node("group", "", 0),
			node("button", "One (category)", 1),
			node("link", "news (text channel)", 1, 150),
			node("button", "Two (category)", 2),
			node("link", "news (text channel)", 2, 250),
		];
		expect(
			resolveChannelHighlight(windowBounds, nested, { name: "news", category: "One" }).y,
		).toBe(150);
		expect(
			resolveChannelHighlight(windowBounds, nested, { name: "news", category: "Two" }).y,
		).toBe(250);
	});

	it("rejects ambiguous, hidden and stale rows", () => {
		expect(() =>
			resolveChannelHighlight(
				windowBounds,
				[...tree, node("link", "news (text channel)", 0, 300)],
				{ name: "news", category: "Two" },
			),
		).toThrow("不唯一");
		expect(() =>
			resolveChannelHighlight(windowBounds, tree, { name: "missing", category: "One" }),
		).toThrow();
		expect(() =>
			resolveChannelHighlight(
				windowBounds,
				tree.map((entry, index) =>
					index === 4
						? {
								...entry,
								presentation: {
									...entry.presentation,
									bounds: { x: 120, y: -500, width: 250, height: 40 },
								},
							}
						: entry,
				),
				{ name: "news", category: "Two" },
			),
		).toThrow();
	});
	it("clips the row to the visible sidebar", () => {
		const clipped = tree.map((entry, index) =>
			index === 4 ? node("link", "news (text channel)", 0, 580) : entry,
		);
		expect(
			resolveChannelHighlight(windowBounds, clipped, { name: "news", category: "Two" }),
		).toEqual({ x: 120, y: 580, width: 250, height: 20 });
	});
	it("translates coordinates on monitors with negative origins and clips to the Discord window", () => {
		expect(
			relativeChannelHighlight(
				{ x: -1700, y: 150, width: 300, height: 40 },
				{ x: -1920, y: 25, width: 1920, height: 1055 },
				{ x: -1650, y: 100, width: 1200, height: 800 },
			),
		).toEqual({ x: 270, y: 125, width: 250, height: 40 });
		expect(relativeChannelHighlight(undefined, windowBounds, windowBounds)).toBeUndefined();
		expect(
			relativeChannelHighlight(
				{ x: 100, y: 1000, width: 100, height: 40 },
				windowBounds,
				windowBounds,
			),
		).toBeUndefined();
	});
});
