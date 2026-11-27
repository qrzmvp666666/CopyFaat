import { afterEach, describe, expect, it, vi } from "vitest";

import { assertDiscordFocused } from "../src/main/discovery/focus";
import { scanDiscordChannels, type DiscoveryAdapter } from "../src/main/discovery/scan";
import {
	channelEntries,
	currentChannelId,
	localId,
	serverNavigation,
	type DesktopNode,
	type DesktopSnapshot,
} from "../src/main/discovery/tree";

function snapshot(children: DesktopNode[], messages: DesktopNode[] = []): DesktopSnapshot {
	return {
		complete: true,
		window: { id: "window-a" },
		tree: {
			children: [
				{
					role: "navigation",
					name: "Example (服务器)",
					children: [{ role: "list", name: "频道", children }],
				},
				...messages,
			],
		},
	};
}
function link(name: string, extra: Partial<DesktopNode> = {}): DesktopNode {
	return { role: "link", name: `${name}（文字频道）`, ref_id: "@snapshot:e1", ...extra };
}
function messageList(name: string, channelId: string): DesktopNode {
	return {
		role: "list",
		name: `${name}中的消息`,
		children: [{ native_id: { value: `chat-messages-${channelId}-999` } }],
	};
}

afterEach(() => vi.useRealTimers());

describe("Discord discovery identity", () => {
	it("extracts real IDs only from the matching channel's message list", () => {
		const data = snapshot(
			[],
			[
				messageList("announcements", "123"),
				{ native_id: { value: "chat-messages-456-999" } },
			],
		);
		expect(currentChannelId(data, "announcements")).toBe("123");
		expect(currentChannelId(data, "other")).toBeUndefined();
	});
	it("refuses conflicting IDs in a message pane", () => {
		const list = messageList("updates", "123");
		list.children!.push({ native_id: { value: "chat-messages-456-888" } });
		expect(currentChannelId(snapshot([], [list]), "updates")).toBeUndefined();
	});
	it("preserves category context and real channel URLs", () => {
		const entries = channelEntries({
			children: [
				{ role: "button", name: "News （类别）" },
				link("未读，updates", { url: "https://discord.com/channels/123/456" }),
			],
		});
		expect(entries[0]).toMatchObject({
			name: "updates",
			category: "News",
			serverId: "123",
			platformId: "456",
		});
	});
	it("rejects ambiguous names in the same category, distinguishes different categories", () => {
		expect(() => channelEntries({ children: [link("same"), link("same")] })).toThrow("同名");
		expect(localId("Example", "A", "same")).not.toBe(localId("Example", "B", "same"));
		expect(localId("Example", "A", "same")).toBe(localId("Example", "A", "same"));
	});
	it("stops when the server changes", () => {
		expect(() => serverNavigation(snapshot([]), "Another")).toThrow("服务器已切换");
	});
	it("scans channels, obtains IDs after opening, keeps fallback locators and excludes temporary refs", async () => {
		vi.useFakeTimers();
		let opened = false;
		const adapter: DiscoveryAdapter = {
			observe: () =>
				snapshot(
					[link("updates"), link("empty", { ref_id: "@snapshot:e2" })],
					opened ? [messageList("updates", "456")] : [],
				),
			act: (ref) => {
				opened = ref === "@snapshot:e1";
			},
			scroll: vi.fn(),
		};
		const pending = scanDiscordChannels(
			adapter,
			{ x: 0, y: 0, width: 200, height: 600 },
			vi.fn(),
		);
		await vi.runAllTimersAsync();
		const result = await pending;
		expect(result.scope.channels[0]).toMatchObject({ id: "456", identity: "discord" });
		expect(result.scope.channels[1]).toMatchObject({
			identity: "local",
			locator: { serverName: "Example", channelName: "empty" },
		});
		expect(result.scope.channels[1].id).toMatch(/^local:/);
		expect(result.complete).toBe(false);
		expect(JSON.stringify(result)).not.toContain("@snapshot");
	});
	it("limits a test scan to three channels without scrolling to another page", async () => {
		vi.useFakeTimers();
		const scroll = vi.fn();
		const entries = ["one", "two", "three", "four"].map((name, index) =>
			link(name, { url: `https://discord.com/channels/123/${index + 1}` }),
		);
		const adapter: DiscoveryAdapter = {
			observe: () => snapshot(entries),
			act: vi.fn(),
			scroll,
		};
		const pending = scanDiscordChannels(
			adapter,
			{ x: 0, y: 0, width: 200, height: 600 },
			vi.fn(),
			{ maxChannels: 3 },
		);
		await vi.runAllTimersAsync();
		const result = await pending;
		expect(result.scope.channels.map((channel) => channel.name)).toEqual([
			"one",
			"two",
			"three",
		]);
		expect(scroll).not.toHaveBeenCalledWith(expect.anything(), "down");
		expect(result.message).toContain("测试模式：最多识别 3 个频道");
	});
	it("does not mistake a stale message pane for a newly selected same-name channel", async () => {
		vi.useFakeTimers();
		const adapter: DiscoveryAdapter = {
			observe: () => snapshot([link("updates")], [messageList("updates", "456")]),
			act: vi.fn(),
			scroll: vi.fn(),
		};
		const pending = scanDiscordChannels(
			adapter,
			{ x: 0, y: 0, width: 200, height: 600 },
			vi.fn(),
		);
		await vi.runAllTimersAsync();
		expect((await pending).scope.channels[0].identity).toBe("local");
	});
	it("retains all observed names if foreground is lost during ID verification", async () => {
		vi.useFakeTimers();
		const adapter: DiscoveryAdapter = {
			observe: () => snapshot([link("updates"), link("empty", { ref_id: "@snapshot:e2" })]),
			act: () => assertDiscordFocused(false),
			scroll: vi.fn(),
		};
		const pending = scanDiscordChannels(
			adapter,
			{ x: 0, y: 0, width: 200, height: 600 },
			vi.fn(),
		);
		await vi.runAllTimersAsync();
		const result = await pending;
		expect(result.scope.channels.map((channel) => channel.name)).toEqual(["updates", "empty"]);
		expect(result.complete).toBe(false);
		expect(result.message).toContain("切换窗口");
	});
	it("publishes a usable partial source before any scrolling or slow ID verification", async () => {
		const snapshots: import("../src/shared/contracts").DiscoveryResult[] = [];
		let paused: (() => void) | undefined;
		const scroll = vi.fn();
		const act = vi.fn();
		const pending = scanDiscordChannels(
			{
				observe: () =>
					snapshot([link("updates"), link("empty", { ref_id: "@snapshot:e2" })]),
				scroll,
				act,
			},
			{ x: 0, y: 0, width: 200, height: 600 },
			vi.fn(),
			{
				onSnapshot: (result) => snapshots.push(result),
				checkpoint: () =>
					new Promise<void>((resolve) => {
						paused = resolve;
					}),
			},
		);
		expect(snapshots[0].scope.server.name).toBe("Example");
		expect(snapshots[0].scope.channels.map((channel) => channel.name)).toEqual([
			"updates",
			"empty",
		]);
		expect(snapshots[0].complete).toBe(false);
		expect(scroll).not.toHaveBeenCalled();
		expect(act).not.toHaveBeenCalled();
		// Terminating the worker uses this snapshot; it does not require the scan promise to finish.
		expect(paused).toBeTypeOf("function");
		void pending;
	});
});
