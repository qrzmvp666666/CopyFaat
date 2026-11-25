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
	target: {
		platform: "telegram",
		server: { id: "target-server", name: "我的资讯" },
		channels: [{ id: "target-channel", name: "产品快讯" }],
	},
	collector: { executable: "collector", args: [] },
	delivery: {
		kind: "signal-webhook",
		endpoint: "https://copyfast.example.test/api/signals/webhook",
		secretId: "signal-secret",
	},
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

async function setup() {
	const root = await mkdtemp(join(tmpdir(), "copyfast-engine-"));
	roots.push(root);
	const store = await createStore(join(root, "state.json"));
	return {
		store,
		engine: createEngine(store, {
			collect: async () => ({ version: 1 as const, messages: [message] }),
			deliver: async () => ({ state: "confirmed" as const, remoteLogId: "log-1" }),
		}),
	};
}

describe("CopyFast task engine", () => {
	it("deduplicates collected messages and records confirmed delivery", async () => {
		const { store, engine } = await setup();
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		await engine.run(taskId);
		const state = store.read();
		expect(state.messages).toHaveLength(1);
		expect(state.messages[0].status).toBe("synced");
		expect(state.messages[0].remoteLogId).toBe("log-1");
		expect(state.logs.some((log) => log.phase === "sync" && log.status === "success")).toBe(
			true,
		);
	});

	it("stops automatic retries when delivery is uncertain", async () => {
		const root = await mkdtemp(join(tmpdir(), "copyfast-uncertain-"));
		roots.push(root);
		const store = await createStore(join(root, "state.json"));
		const engine = createEngine(store, {
			collect: async () => ({ version: 1 as const, messages: [message] }),
			deliver: async () => ({ state: "uncertain" as const, error: "no receipt" }),
		});
		const taskId = await engine.saveTask(input);
		await engine.action(taskId, "resume");
		await new Promise((resolve) => setTimeout(resolve, 20));
		const state = store.read();
		expect(state.tasks.find((task) => task.id === taskId)?.status).toBe("attention");
		expect(state.messages[0].status).toBe("uncertain");
		await expect(engine.action(taskId, "resume")).rejects.toThrow("未确认");
	});
});
