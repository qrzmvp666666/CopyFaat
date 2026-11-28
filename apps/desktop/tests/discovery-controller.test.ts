import { EventEmitter } from "node:events";

import { afterAll, afterEach, expect, it, vi } from "vitest";

import type { DiscoveryResult } from "../src/shared/contracts";

interface TestSurface extends EventEmitter {
	webContents: { send: ReturnType<typeof vi.fn> };
	setBounds: ReturnType<typeof vi.fn>;
}
interface TestWorker extends EventEmitter {
	postMessage: ReturnType<typeof vi.fn>;
	kill: ReturnType<typeof vi.fn>;
}
interface TestEvent {
	sender: unknown;
}
type IpcHandler = (event: TestEvent, choice?: boolean, selectedChannelIds?: unknown) => unknown;

const mocks = vi.hoisted(() => ({
	handlers: new Map<string, IpcHandler>(),
	escape: undefined as (() => void) | undefined,
	overlays: [] as TestSurface[],
	workers: [] as TestWorker[],
}));
const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
Object.defineProperty(process, "platform", { configurable: true, value: "linux" });
vi.mock("electron", async () => {
	const { EventEmitter } = await import("node:events");
	class Window extends EventEmitter {
		webContents = { send: vi.fn() };
		setBounds = vi.fn();
		setFocusable = vi.fn();
		show = vi.fn();
		focus = vi.fn();
		setAlwaysOnTop = vi.fn();
		setIgnoreMouseEvents = vi.fn();
		showInactive = vi.fn();
		destroy = vi.fn();
		loadURL = vi.fn(async () => {});
		constructor() {
			super();
			mocks.overlays.push(this);
		}
	}
	return {
		BrowserWindow: Window,
		ipcMain: {
			handle: (name: string, handler: IpcHandler) => mocks.handlers.set(name, handler),
		},
		globalShortcut: {
			register: (_key: string, handler: () => void) => {
				mocks.escape = handler;
				return true;
			},
			unregister: vi.fn(),
		},
		screen: {
			getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }),
		},
		utilityProcess: {
			fork: () => {
				const worker = Object.assign(new EventEmitter(), {
					postMessage: vi.fn(),
					kill: vi.fn(),
				});
				mocks.workers.push(worker);
				return worker;
			},
		},
	};
});
vi.mock("../src/main/discovery/runtime", () => ({
	resolveEngineDirectory: () => "/synthetic-engine",
}));
import { registerDiscovery } from "../src/main/discovery/controller";

function setup() {
	const workspace = Object.assign(new EventEmitter(), {
		webContents: { send: vi.fn() },
		hide: vi.fn(),
		show: vi.fn(),
		focus: vi.fn(),
	});
	const controller = registerDiscovery(
		() => workspace as never,
		(route) => route,
		async () => true,
	);
	return { workspace, controller };
}
const result: DiscoveryResult = {
	scope: {
		platform: "discord",
		server: { id: "s", name: "Example" },
		channels: [
			{ id: "a", name: "公告" },
			{ id: "b", name: "动态" },
		],
	},
	complete: false,
	message: "部分识别结果",
};
afterEach(() => {
	mocks.handlers.clear();
	mocks.workers.length = 0;
	mocks.overlays.length = 0;
	vi.useRealTimers();
});

afterAll(() => {
	if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor);
});

it("pauses on Exit/Esc, lists observed channels, resumes without resolving, then returns partial scope on confirmed exit", async () => {
	const { workspace } = setup();
	const pending = mocks.handlers.get("discover-discord-channels")!({
		sender: workspace.webContents,
	});
	await Promise.resolve();
	await Promise.resolve();
	const worker = mocks.workers[0];
	worker.emit("message", { type: "ready", bounds: { x: 0, y: 0, width: 1200, height: 800 } });
	const overlay = mocks.overlays[0];
	overlay.emit("ready-to-show");
	worker.emit("message", { type: "snapshot", result });
	mocks.escape!();
	expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "pause" });
	expect(worker.kill).not.toHaveBeenCalled();
	worker.emit("message", { type: "paused" });
	expect(overlay.webContents.send).toHaveBeenLastCalledWith(
		"discovery-progress",
		expect.objectContaining({
			phase: "paused",
			serverName: "Example",
			channelNames: ["公告", "动态"],
		}),
	);
	// A background renderer cannot confirm an overlay decision.
	mocks.handlers.get("resolve-discovery-exit")!({ sender: workspace.webContents }, false);
	expect(worker.kill).not.toHaveBeenCalled();
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, true);
	expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "resume" });
	mocks.handlers.get("cancel-discovery")!({ sender: overlay.webContents });
	worker.emit("message", { type: "paused" });
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false);
	expect(await pending).toEqual(result);
	expect(worker.kill).toHaveBeenCalledOnce();
	expect(workspace.show).toHaveBeenCalled();
});

it("returns to source settings if exit is confirmed before any channels are observed", async () => {
	const { workspace } = setup();
	const pending = mocks.handlers.get("discover-discord-channels")!({
		sender: workspace.webContents,
	});
	await Promise.resolve();
	await Promise.resolve();
	const worker = mocks.workers[0];
	worker.emit("message", { type: "ready", bounds: { x: 0, y: 0, width: 1200, height: 800 } });
	const overlay = mocks.overlays[0];
	overlay.emit("ready-to-show");
	mocks.escape!();
	worker.emit("message", { type: "paused" });
	expect(overlay.webContents.send).toHaveBeenLastCalledWith(
		"discovery-progress",
		expect.objectContaining({ found: 0, channelNames: [] }),
	);
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false);
	expect(await pending).toBeNull();
});

it("does not discard a result when scan completion races with the exit request", async () => {
	const { workspace } = setup();
	const pending = mocks.handlers.get("discover-discord-channels")!({
		sender: workspace.webContents,
	});
	await Promise.resolve();
	await Promise.resolve();
	const worker = mocks.workers[0];
	worker.emit("message", { type: "ready", bounds: { x: 0, y: 0, width: 1200, height: 800 } });
	const overlay = mocks.overlays[0];
	overlay.emit("ready-to-show");
	mocks.escape!();
	worker.emit("message", { type: "result", result });
	expect(worker.kill).not.toHaveBeenCalled();
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, true);
	expect(await pending).toEqual(result);
});

it("does not expire the results while waiting for the user's exit decision", async () => {
	vi.useFakeTimers();
	const { workspace } = setup();
	const pending = mocks.handlers.get("discover-discord-channels")!({
		sender: workspace.webContents,
	});
	await Promise.resolve();
	await Promise.resolve();
	const worker = mocks.workers[0];
	worker.emit("message", { type: "ready", bounds: { x: 0, y: 0, width: 1200, height: 800 } });
	const overlay = mocks.overlays[0];
	overlay.emit("ready-to-show");
	worker.emit("message", { type: "snapshot", result });
	mocks.escape!();
	worker.emit("message", { type: "paused" });
	await vi.advanceTimersByTimeAsync(20 * 60_000);
	expect(worker.kill).not.toHaveBeenCalled();
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false);
	expect(await pending).toEqual(result);
});

async function pauseWithResult(snapshot = result) {
	const { workspace } = setup();
	const pending = mocks.handlers.get("discover-discord-channels")!({
		sender: workspace.webContents,
	});
	await Promise.resolve();
	await Promise.resolve();
	const worker = mocks.workers[0];
	worker.emit("message", { type: "ready", bounds: { x: 0, y: 0, width: 1200, height: 800 } });
	const overlay = mocks.overlays[0];
	overlay.emit("ready-to-show");
	worker.emit("message", { type: "snapshot", result: snapshot });
	mocks.escape!();
	worker.emit("message", { type: "paused" });
	return { pending, worker, overlay, workspace };
}

it("returns only selected channel IDs and preserves channel identity and fallback locators", async () => {
	const snapshot: DiscoveryResult = {
		...result,
		scope: {
			...result.scope,
			channels: [
				{
					id: "a",
					name: "同名频道",
					identity: "local",
					locator: { serverName: "Example", category: "策略", channelName: "同名频道" },
				},
				{ id: "b", name: "同名频道", identity: "discord" },
			],
		},
	};
	const { pending, overlay } = await pauseWithResult(snapshot);
	expect(overlay.webContents.send).toHaveBeenLastCalledWith(
		"discovery-progress",
		expect.objectContaining({ channels: snapshot.scope.channels }),
	);
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false, ["a"]);
	expect(await pending).toEqual(
		expect.objectContaining({
			scope: { ...snapshot.scope, channels: [snapshot.scope.channels[0]] },
		}),
	);
});

it("returns to source settings when the user clears every channel", async () => {
	const { pending, overlay } = await pauseWithResult();
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false, []);
	expect(await pending).toBeNull();
});

it("rejects invalid and unknown selections without closing the confirmation", async () => {
	const { pending, overlay, worker, workspace } = await pauseWithResult();
	const decide = mocks.handlers.get("resolve-discovery-exit")!;
	for (const ids of [["unknown"], [12], "a", null]) {
		expect(() => decide({ sender: overlay.webContents }, false, ids)).toThrow("频道选择无效");
	}
	decide({ sender: workspace.webContents }, false, ["a"]);
	expect(worker.kill).not.toHaveBeenCalled();
	decide({ sender: overlay.webContents }, false, ["b"]);
	expect(
		((await pending) as DiscoveryResult).scope.channels.map((channel) => channel.id),
	).toEqual(["b"]);
});

it("does not include late results that were not shown in the selection list", async () => {
	const { pending, overlay, worker } = await pauseWithResult();
	worker.emit("message", {
		type: "result",
		result: {
			...result,
			scope: {
				...result.scope,
				channels: [...result.scope.channels, { id: "c", name: "迟到频道" }],
			},
		},
	});
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, false, [
		"a",
		"b",
	]);
	expect(((await pending) as DiscoveryResult).scope.channels).toEqual(result.scope.channels);
});

it("keeps exclusions when resumed discovery completes and includes newly discovered channels", async () => {
	const { pending, overlay, worker } = await pauseWithResult();
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, true, ["b"]);
	worker.emit("message", {
		type: "result",
		result: {
			...result,
			scope: {
				...result.scope,
				channels: [...result.scope.channels, { id: "c", name: "新增频道" }],
			},
		},
	});
	expect(
		((await pending) as DiscoveryResult).scope.channels.map((channel) => channel.id),
	).toEqual(["b", "c"]);
});

it("applies exclusions if discovery completes while the exit confirmation is open", async () => {
	const { pending, overlay, worker } = await pauseWithResult();
	worker.emit("message", { type: "result", result });
	mocks.handlers.get("resolve-discovery-exit")!({ sender: overlay.webContents }, true, ["b"]);
	expect(
		((await pending) as DiscoveryResult).scope.channels.map((channel) => channel.id),
	).toEqual(["b"]);
});
