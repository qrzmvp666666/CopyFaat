import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
		expect(state.tasks.find((task) => task.id === taskId)?.status).toBe("attention");
		expect(state.logs.find((log) => log.phase === "collect")).toMatchObject({
			status: "failed",
			error: "collector unavailable",
		});
	});

	it("deletes a task without removing its collection history", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		await engine.deleteTask(taskId);
		const state = store.read();
		expect(state.tasks).toHaveLength(0);
		expect(state.messages).toHaveLength(1);
		expect(state.logs.some((log) => log.taskId === taskId)).toBe(true);
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
			{ channelId: "source-channel", status: "success", collected: 2, saved: 1, ignored: 1 },
			{ channelId: "second", status: "skipped", collected: 1, saved: 0, ignored: 1 },
			{ channelId: "empty", status: "skipped", collected: 0, saved: 0, ignored: 0 },
		]);
	});
	it("schedules retries and stops when the configured allowance is exhausted", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-retry-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		let time = 100000;
		const engine = createEngine(store, {
			now: () => time,
			collect: async () => {
				throw new Error("暂时不可用");
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
		expect(store.read().tasks[0].status).toBe("attention");
		expect(store.read().logs.filter((log) => log.phase === "collect")).toHaveLength(2);
	});
});
