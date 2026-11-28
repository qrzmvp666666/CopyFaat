import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createEngine } from "../src/main/engine";
import { createStore } from "../src/main/store";
import type { CollectedMessage, TaskInput } from "../src/shared/contracts";

const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const input: TaskInput = {
	name: "Discord 产品更新",
	source: {
		platform: "discord",
		server: { id: "source-server", name: "产品社区" },
		channels: [{ id: "source-channel", name: "产品更新" }],
	},
	receiver: {
		platform: "discord",
		channels: [
			{
				sourceChannelId: "source-channel",
				target: { id: "", name: "产品资讯" },
				webhookUrl: "https://discord.com/api/webhooks/123/synthetic-token",
			},
		],
	},
	rules: {
		intervalSeconds: 30,
		startAt: new Date(0).toISOString(),
		markRead: false,
		include: "",
		exclude: "",
		maxRetries: 2,
		retrySeconds: 10,
		text: true,
		images: true,
		attachments: true,
	},
};

const message: CollectedMessage = {
	id: "message-1",
	channelId: "source-channel",
	author: "Ada",
	text: "New release",
	sentAt: new Date(1000).toISOString(),
	attachments: [],
	mediaLabels: [],
	signal: { kind: "release" },
};

async function setup(messages: CollectedMessage[] = [message]) {
	const root = await mkdtemp(join(tmpdir(), "copyfast-engine-"));
	roots.push(root);
	const store = await createStore(join(root, "state.json"));
	return {
		path: join(root, "state.json"),
		store,
		engine: createEngine(store, {
			collect: async (task) => ({
				version: 1 as const,
				messages,
				channels: task.source.channels.map((channel) => ({
					channelId: channel.id,
					status: "unread" as const,
					collected: messages.filter((message) => message.channelId === channel.id)
						.length,
				})),
			}),
		}),
	};
}

describe("CopyFast task engine", () => {
	it("requires per-channel Webhooks before starting a task", async () => {
		const { engine, store } = await setup();
		const { receiver: _receiver, ...configuration } = input;
		await expect(engine.saveTask({ ...configuration, startPaused: false })).rejects.toThrow(
			"请先为每个来源频道配置 Discord Webhook 地址",
		);
		expect(store.read().tasks).toHaveLength(0);
	});

	it("persists receiver mappings and paused tasks across a restart without collecting", async () => {
		const { store, engine, path } = await setup();
		const id = await engine.saveTask({
			...input,
			startPaused: true,
			receiver: {
				platform: "discord",
				channels: [
					{
						sourceChannelId: "source-channel",
						target: { id: "", name: "产品资讯" },
						webhookUrl: "https://discord.com/api/webhooks/123/synthetic-token",
					},
				],
			},
		});
		expect(store.read().tasks[0]).toMatchObject({
			id,
			status: "paused",
			receiver: {
				platform: "discord",
				channels: [{ target: { name: "产品资讯" } }],
			},
		});
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(0);
		const reopened = await createStore(path);
		expect(reopened.read().tasks).toEqual(store.read().tasks);
	});

	it("starts a new task only when immediate collection was explicitly selected", async () => {
		const { store, engine } = await setup();
		await engine.saveTask({
			...input,
			startPaused: false,
			rules: { ...input.rules, text: false, images: true, attachments: true },
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(store.read().tasks[0].status).toBe("running");
		expect(store.read().logs.some((log) => log.phase === "collect")).toBe(true);
		expect(store.read().messages[0]).toMatchObject({ text: "", status: "filtered" });
		const pausedId = await engine.saveTask(input);
		expect(store.read().tasks.find((task) => task.id === pausedId)?.status).toBe("paused");
	});

	it("saving rules only pauses an existing running task and preserves its receiver", async () => {
		const { store, engine } = await setup();
		const id = await engine.saveTask(input);
		await store.update((state) => {
			state.tasks[0].status = "running";
		});
		await engine.saveTask(
			{ ...input, startPaused: true, rules: { ...input.rules, intervalSeconds: 300 } },
			id,
		);
		await engine.tick();
		expect(store.read().tasks[0]).toMatchObject({
			status: "paused",
			receiver: input.receiver,
			rules: { intervalSeconds: 300 },
		});
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(0);
	});

	it("waits for an interrupted collection to finish before restarting with new rules", async () => {
		const { store } = await setup();
		const intervals: number[] = [];
		let finishOldRun: (() => void) | undefined;
		const engine = createEngine(store, {
			collect: async (task, signal) => {
				intervals.push(task.rules.intervalSeconds);
				if (intervals.length === 1) {
					await new Promise<void>((resolve) => {
						finishOldRun = resolve;
					});
					expect(signal.aborted).toBe(true);
				}
				return { version: 1, messages: [], channels: [] };
			},
		});
		const id = await engine.saveTask(input);
		await engine.action(id, "resume");
		await vi.waitFor(() => expect(finishOldRun).toBeDefined());
		let saved = false;
		const save = engine
			.saveTask(
				{ ...input, startPaused: true, rules: { ...input.rules, intervalSeconds: 300 } },
				id,
			)
			.then(() => {
				saved = true;
			});
		await engine.tick();
		expect(saved).toBe(false);
		expect(intervals).toEqual([30]);
		finishOldRun!();
		await save;
		expect(store.read().tasks[0].status).toBe("paused");
		await engine.action(id, "resume");
		await vi.waitFor(() => expect(intervals).toEqual([30, 300]));
		await engine.action(id, "pause");
		expect(store.read().tasks[0].status).toBe("paused");
	});

	it("keeps the saved configuration paused if starting it is rejected", async () => {
		const { engine, store } = await setup();
		const { receiver: _receiver, ...withoutReceiver } = input;
		const id = await engine.saveTask({ ...withoutReceiver, startPaused: true });
		await expect(engine.action(id, "resume")).rejects.toThrow(
			"请先为每个来源频道配置 Discord Webhook 地址",
		);
		expect(store.read().tasks[0]).toMatchObject({ status: "paused", rules: input.rules });
	});

	it("rejects invalid edits without changing the running task", async () => {
		const { engine, store } = await setup();
		const id = await engine.saveTask(input);
		await store.update((state) => {
			state.tasks[0].status = "running";
		});
		await expect(
			engine.saveTask(
				{ ...input, startPaused: true, rules: { ...input.rules, intervalSeconds: 1 } },
				id,
			),
		).rejects.toThrow();
		expect(store.read().tasks[0]).toMatchObject({
			status: "running",
			rules: { intervalSeconds: 30 },
			receiver: input.receiver,
		});
	});

	it("deduplicates repeated messages in one collection batch", async () => {
		const { store, engine } = await setup([message, message]);
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const state = store.read();
		expect(state.messages).toHaveLength(1);
		expect(state.logs.find((log) => log.phase === "collect")).toMatchObject({
			collected: 2,
			saved: 1,
			ignored: 1,
		});
		expect(state.messages[0]).toMatchObject({
			taskName: input.name,
			platform: "discord",
			sourceName: "产品社区",
			channelName: "产品更新",
		});
	});

	it("saves collected messages locally and ignores duplicate results", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		await engine.run(taskId);
		const state = store.read();
		expect(state.messages).toHaveLength(1);
		expect(state.messages[0].status).toBe("collected");
		const collectionLogs = state.logs.filter((log) => log.phase === "collect");
		expect(collectionLogs).toHaveLength(2);
		expect(collectionLogs[0]).toMatchObject({ status: "success", collected: 1, saved: 1 });
		expect(collectionLogs[1]).toMatchObject({
			status: "success",
			collected: 1,
			saved: 0,
			ignored: 1,
		});
	});

	it.each([
		["before-start", { startAt: new Date(2000).toISOString() }, message],
		["missing-keyword", { include: "launch" }, message],
		["excluded-keyword", { exclude: "release" }, message],
		["empty-content", { text: false }, message],
	] as const)("records %s as the concrete filtering reason", async (reason, rules, item) => {
		const { store, engine } = await setup([item]);
		const id = await engine.saveTask({ ...input, rules: { ...input.rules, ...rules } });
		await engine.action(id, "resume");
		await vi.waitFor(() =>
			expect(
				store.read().logs.find((log) => log.phase === "collect")?.finishedAt,
			).toBeDefined(),
		);
		const state = store.read();
		expect(state.messages[0]).toMatchObject({ status: "filtered", ignoredReason: reason });
		expect(
			state.logs.find((log) => log.phase === "collect")?.channelResults?.[0],
		).toMatchObject({ ignored: 1, ignoredReasons: { [reason]: 1 } });
	});

	it("applies keyword rules and records filtered items", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask({
			...input,
			rules: { ...input.rules, include: "launch" },
		});
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const state = store.read();
		expect(state.messages).toHaveLength(1);
		expect(state.messages[0].status).toBe("filtered");
		expect(state.logs.find((log) => log.phase === "collect")).toMatchObject({
			status: "success",
			collected: 1,
			saved: 0,
			ignored: 1,
		});
	});

	it("keeps image-only messages when media collection is enabled", async () => {
		const mediaMessage: CollectedMessage = {
			...message,
			id: "image-only",
			text: "",
			mediaLabels: [{ kind: "image", label: "图片" }],
		};
		const { store, engine } = await setup([mediaMessage]);
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(store.read().messages[0]).toMatchObject({
			text: "",
			mediaLabels: [{ kind: "image", label: "图片" }],
			status: "collected",
		});
	});

	it("skips channels reported as already read", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-read-channel-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const engine = createEngine(store, {
			collect: async (task) => ({
				version: 1,
				messages: [],
				channels: task.source.channels.map((channel) => ({
					channelId: channel.id,
					status: "skipped_read" as const,
					collected: 0,
				})),
			}),
		});
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(store.read().messages).toHaveLength(0);
		expect(
			store.read().logs.find((log) => log.phase === "collect")?.channelResults?.[0].status,
		).toBe("skipped_read");
	});

	it("persists the message before posting and records the confirmed delivery", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-outbox-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const engine = createEngine(store, {
			collect: async () => ({
				version: 1,
				messages: [message],
				channels: [{ channelId: "source-channel", status: "unread", collected: 1 }],
			}),
			deliver: async () => {
				expect(store.read().messages[0]).toMatchObject({ status: "sending", attempts: 1 });
				return { status: "sent", httpStatus: 204 };
			},
		});
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(store.read().messages[0]).toMatchObject({ status: "synced", attempts: 1 });
		expect(store.read().logs.find((log) => log.phase === "collect")?.httpStatus).toBe(204);
	});

	it("scrolls only after this round's new messages were delivered successfully", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-mark-read-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const finishedChannels: string[][] = [];
		const activityPhases: string[] = [];
		await store.update((state) => {
			state.messages.push({
				...message,
				key: "historical-failure",
				taskId: "task-to-be-created",
				batchId: "previous-batch",
				collectedAt: new Date(2000).toISOString(),
				status: "failed",
				attempts: 1,
			});
		});
		const engine = createEngine(store, {
			collect: async () => ({
				version: 1,
				messages: [message],
				channels: [{ channelId: "source-channel", status: "unread", collected: 1 }],
			}),
			deliver: async () => ({ status: "sent", httpStatus: 204 }),
			finishUnreadChannels: async (_task, channelIds) => {
				finishedChannels.push(channelIds);
			},
			activity: (_task, phase) => activityPhases.push(phase),
		});
		const taskId = await engine.saveTask({
			...input,
			rules: { ...input.rules, markRead: true },
		});
		await store.update((state) => {
			const historical = state.messages.find((item) => item.key === "historical-failure");
			if (historical) historical.taskId = taskId;
		});
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(finishedChannels).toEqual([["source-channel"]]);
		expect(activityPhases).toEqual(["collect", "send", "mark-read", "idle"]);
	});

	it("marks collection failures in the task and execution log", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-collector-failure-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const engine = createEngine(store, {
			collect: async () => {
				throw new Error("collector unavailable");
			},
		});
		const taskId = await engine.saveTask({
			...input,
			rules: { ...input.rules, maxRetries: 0 },
		});
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const state = store.read();
		expect(state.tasks.find((task) => task.id === taskId)?.status).toBe("running");
		expect(state.logs.find((log) => log.phase === "collect")).toMatchObject({
			status: "failed",
			error: "collector unavailable",
		});
	});

	it("requires attention for invalid configuration instead of polling forever", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask(input);
		await store.update((state) => {
			state.tasks[0].status = "running";
			state.tasks[0].receiver = undefined;
		});
		await engine.run(taskId);
		expect(store.read().tasks[0]).toMatchObject({
			status: "attention",
			error: "请先为每个来源频道配置 Discord Webhook 地址。",
		});
	});

	it("deletes a task and only its associated messages and logs", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const otherTaskId = await engine.saveTask({ ...input, name: "保留任务" });
		await store.update((state) => {
			const taskMessage = state.messages.find((item) => item.taskId === taskId)!;
			state.messages.push({
				...taskMessage,
				id: "other-task-message",
				key: `${otherTaskId}:source-channel:other-task-message`,
				taskId: otherTaskId,
			});
			const taskLog = state.logs.find((item) => item.taskId === taskId)!;
			state.logs.push({ ...taskLog, id: "other-task-log", taskId: otherTaskId });
		});

		await engine.deleteTask(taskId);

		const state = store.read();
		expect(state.tasks.map((task) => task.id)).toEqual([otherTaskId]);
		expect(state.messages.map((item) => item.taskId)).toEqual([otherTaskId]);
		expect(state.logs.every((log) => log.taskId !== taskId)).toBe(true);
		expect(state.logs.some((log) => log.taskId === otherTaskId)).toBe(true);
	});
	it("keeps per-channel counts for saved, duplicate, filtered and empty results", async () => {
		const { store, engine } = await setup([
			message,
			message,
			{ ...message, id: "other", channelId: "second", text: "ignore" },
		]);
		const id = await engine.saveTask({
			...input,
			source: {
				...input.source,
				channels: [
					...input.source.channels,
					{ id: "second", name: "第二频道" },
					{ id: "empty", name: "空频道" },
				],
			},
			receiver: {
				platform: "discord",
				channels: [
					...input.receiver!.channels,
					{
						sourceChannelId: "second",
						target: { id: "", name: "第二频道" },
						webhookUrl: "https://discord.com/api/webhooks/456/second-token",
					},
					{
						sourceChannelId: "empty",
						target: { id: "", name: "空频道" },
						webhookUrl: "https://discord.com/api/webhooks/789/empty-token",
					},
				],
			},
			rules: { ...input.rules, exclude: "ignore" },
		});
		await engine.action(id, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const log = store.read().logs.find((log) => log.phase === "collect")!;
		expect(log.channelResults).toMatchObject([
			{
				channelId: "source-channel",
				status: "success",
				collected: 2,
				saved: 1,
				ignored: 1,
				ignoredReasons: { duplicate: 1 },
			},
			{
				channelId: "second",
				status: "skipped",
				collected: 1,
				saved: 0,
				ignored: 1,
				ignoredReasons: { "excluded-keyword": 1 },
			},
			{ channelId: "empty", status: "skipped", collected: 0, saved: 0, ignored: 0 },
		]);
	});
	it("returns to regular polling after the retry allowance is exhausted, then recovers", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-retry-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		let time = 100000;
		const engine = createEngine(store, {
			now: () => time,
			collect: async () => {
				if (time < 140000) throw new Error("暂时不可用");
				return { version: 1, messages: [], channels: [] };
			},
		});
		const id = await engine.saveTask({ ...input, rules: { ...input.rules, maxRetries: 1 } });
		await engine.action(id, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(store.read().tasks[0]).toMatchObject({
			status: "running",
			retryAttempt: 1,
			nextRunAt: new Date(110000).toISOString(),
		});
		expect(
			store.read().logs.find((log) => log.phase === "collect")?.channelResults?.[0].status,
		).toBe("failed");
		time = 110000;
		await engine.tick();
		expect(store.read().tasks[0]).toMatchObject({
			status: "running",
			retryAttempt: 0,
			nextRunAt: new Date(140000).toISOString(),
		});
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(2);
		time = 139999;
		await engine.tick();
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(2);
		time = 140000;
		await engine.tick();
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(3);
		expect(store.read().tasks[0]).toMatchObject({ status: "running", retryAttempt: 0 });
		expect(store.read().tasks[0].error).toBeUndefined();
	});
});
