import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Task, TaskChannelProgress } from "../src/shared/contracts";

const mock = vi.hoisted(() => {
	const window = {
		setBounds: vi.fn(),
		setAlwaysOnTop: vi.fn(),
		setIgnoreMouseEvents: vi.fn(),
		on: vi.fn(),
		loadURL: vi.fn(),
		showInactive: vi.fn(),
		hide: vi.fn(),
		destroy: vi.fn(),
		isDestroyed: () => false,
		isVisible: () => false,
		webContents: { send: vi.fn() },
	};
	return { window, create: vi.fn(), workArea: { x: 100, y: 50, width: 1200, height: 800 } };
});
vi.mock("electron", () => ({
	BrowserWindow: vi.fn(function (options) {
		mock.create(options);
		return mock.window;
	}),
	screen: {
		getDisplayMatching: () => ({ workArea: mock.workArea }),
		getPrimaryDisplay: () => ({ workArea: mock.workArea }),
		screenToDipRect: (_window: unknown, bounds: unknown) => bounds,
	},
}));
import { createTaskActivityOverlay } from "../src/main/task-activity-overlay";

beforeEach(() => vi.clearAllMocks());

describe("channel activity overlay lifecycle", () => {
	it("moves the frame with channel progress and clears it when locating, sending, or stopping", () => {
		const overlay = createTaskActivityOverlay((route) => `http://localhost/#${route}`);
		const task = { id: "test", name: "Example" } as Task;
		const channel: TaskChannelProgress = {
			channelId: "1",
			channelName: "news",
			index: 1,
			total: 2,
			status: "scanning",
			bounds: { x: 150, y: 200, width: 300, height: 40 },
		};
		overlay.update(task, "collect", mock.workArea);
		overlay.update(task, "collect", undefined, channel);
		expect(overlay.state()?.highlightBounds).toEqual({ x: 50, y: 150, width: 300, height: 40 });
		expect(mock.create).toHaveBeenCalledWith(
			expect.objectContaining({ transparent: true, focusable: false }),
		);
		expect(mock.window.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
		expect(mock.window.showInactive).toHaveBeenCalled();
		overlay.update(task, "collect", undefined, {
			...channel,
			bounds: undefined,
			status: "locating",
			channelId: "2",
			channelName: "updates",
			index: 2,
		});
		expect(overlay.state()?.highlightBounds).toBeUndefined();
		expect(overlay.state()?.channel?.channelName).toBe("updates");
		overlay.update(task, "send");
		expect(overlay.state()?.channel).toBeUndefined();
		expect(overlay.state()?.highlightBounds).toBeUndefined();
		overlay.update(task, "idle");
		expect(overlay.state()).toBeNull();
		expect(mock.window.hide).toHaveBeenCalled();
		expect(mock.window.webContents.send).toHaveBeenLastCalledWith("task-activity", null);
		overlay.close();
	});
});
