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
	collector: { executable: "collector", args: [] },
	rules: {
		intervalSeconds: 30,
		startAt: new Date(0).toISOString(),
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
	signal: { kind: "release" },
};

async function setup(messages: CollectedMessage[] = [message]) {
	const root = await mkdtemp(join(tmpdir(), "copyfast-engine-"));
	roots.push(root);
	const store = await createStore(join(root, "state.json"));
	return {
		store,
		engine: createEngine(store, {
			collect: async () => ({ version: 1 as const, messages }),
		}),
	};
}

describe("CopyFast task engine", () => {
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

	it("marks collection failures in the task and execution log", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-collector-failure-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const engine = createEngine(store, {
			collect: async () => {
				throw new Error("collector unavailable");
			},
		});
		const taskId = await engine.saveTask(input);
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
});
