import { randomUUID } from "node:crypto";

import {
	taskInputSchema,
	type CollectorResponse,
	type Message,
	type Task,
	type TaskInput,
	type TaskLog,
} from "../shared/contracts";
import type { StateStore } from "./store";

export interface EngineDependencies {
	collect(task: Task, signal: AbortSignal): Promise<CollectorResponse>;
	now?: () => number;
}
export function createEngine(store: StateStore, deps: EngineDependencies) {
	const active = new Map<string, AbortController>();
	const now = deps.now ?? Date.now;
	const stamp = () => new Date(now()).toISOString();
	let timer: ReturnType<typeof setInterval> | undefined;

	async function recover() {
		await store.update((state) => {
			for (const message of state.messages)
				if (message.status === "sending") message.status = "collected";
			for (const log of state.logs)
				if (log.status === "processing") {
					log.status = "uncertain";
					log.finishedAt = stamp();
					log.error = "上次执行中断，未取得完整结果";
					for (const channel of log.channelResults ?? []) {
						channel.status = "uncertain";
						channel.error = log.error;
					}
				}
		});
	}
	async function saveTask(input: TaskInput, id?: string) {
		const parsed = taskInputSchema.parse(input);
		active.get(id ?? "")?.abort();
		const taskId = id ?? randomUUID();
		await store.update((state) => {
			const existing = state.tasks.find((t) => t.id === taskId);
			if (id && !existing) throw new Error("任务不存在");
			const changedScope =
				existing && JSON.stringify(existing.source) !== JSON.stringify(parsed.source);
			if (existing)
				Object.assign(existing, parsed, {
					cursor: changedScope ? undefined : existing.cursor,
					nextRunAt: stamp(),
					retryAttempt: 0,
				});
			else
				state.tasks.push({
					...parsed,
					id: taskId,
					status: "paused",
					createdAt: stamp(),
					nextRunAt: stamp(),
				});
			state.logs.push({
				id: randomUUID(),
				taskId,
				phase: "settings",
				status: "success",
				startedAt: stamp(),
				finishedAt: stamp(),
				collected: 0,
				saved: 0,
				ignored: 0,
				failed: 0,
				messageKeys: [],
			});
		});
		return taskId;
	}
	async function deleteTask(id: string) {
		active.get(id)?.abort();
		await store.update((state) => {
			const index = state.tasks.findIndex((task) => task.id === id);
			if (index < 0) throw new Error("任务不存在");
			state.tasks.splice(index, 1);
		});
	}
	async function action(id: string, action: "pause" | "resume" | "run") {
		if (action === "pause") active.get(id)?.abort();
		await store.update((state) => {
			const task = state.tasks.find((t) => t.id === id);
			if (!task) throw new Error("任务不存在");
			task.status = action === "pause" ? "paused" : "running";
			task.error = undefined;
			task.retryAttempt = 0;
			task.nextRunAt = stamp();
		});
		if (action !== "pause") void run(id);
	}
	async function run(id: string) {
		if (active.has(id)) return;
		const controller = new AbortController();
		active.set(id, controller);
		const startedAt = now();
		const batchId = randomUUID();
		try {
			const task = store.read().tasks.find((t) => t.id === id);
			if (!task || task.status !== "running") return;
			const log: TaskLog = {
				channelIds: task.source.channels.map((channel) => channel.id),
				taskName: task.name,
				sourceName: task.source.server.name,
				platform: task.source.platform,
				attempt: task.retryAttempt ?? 0,
				channelResults: task.source.channels.map((channel) => ({
					channelId: channel.id,
					channelName: channel.name,
					status: "processing",
					collected: 0,
					saved: 0,
					ignored: 0,
					failed: 0,
				})),
				id: batchId,
				taskId: id,
				phase: "collect",
				status: "processing",
				startedAt: stamp(),
				collected: 0,
				saved: 0,
				ignored: 0,
				failed: 0,
				messageKeys: [],
			};
			await store.update((state) => {
				state.logs.push(log);
			});
			const result = await deps.collect(task, controller.signal);
			if (controller.signal.aborted) throw new Error("采集已取消");
			const channelIds = new Set(task.source.channels.map((c) => c.id));
			if (result.messages.some((m) => !channelIds.has(m.channelId)))
				throw new Error("脚本返回了当前采集范围以外的频道，已拒绝此批次");
			await store.update((state) => {
				const current = state.tasks.find((t) => t.id === id);
				if (!current || current.status !== "running" || controller.signal.aborted)
					throw new Error("采集已取消");
				const seen = new Set(state.messages.map((m) => m.key));
				const currentLog = state.logs.find((l) => l.id === batchId)!;
				currentLog.collected = result.messages.length;
				for (const item of result.messages) {
					const channelResult = currentLog.channelResults!.find(
						(channel) => channel.channelId === item.channelId,
					)!;
					channelResult.collected++;
					const key = `${id}:${item.channelId}:${item.id}`;
					if (seen.has(key)) {
						currentLog.ignored++;
						channelResult.ignored++;
						continue;
					}
					seen.add(key);
					const allowedTime = Date.parse(item.sentAt) >= Date.parse(task.rules.startAt);
					const included =
						!task.rules.include ||
						task.rules.include
							.split(/[,，\n]/)
							.filter(Boolean)
							.some((k) => item.text.includes(k.trim()));
					const excluded = task.rules.exclude
						.split(/[,，\n]/)
						.filter(Boolean)
						.some((k) => item.text.includes(k.trim()));
					const attachments = item.attachments.filter((a) =>
						a.kind === "image" ? task.rules.images : task.rules.attachments,
					);
					const text = task.rules.text ? item.text : "";
					const filtered =
						!allowedTime || !included || excluded || (!text && !attachments.length);
					const message: Message = {
						...item,
						text,
						attachments,
						key,
						taskId: id,
						taskName: task.name,
						platform: task.source.platform,
						sourceName: task.source.server.name,
						channelName: task.source.channels.find(
							(channel) => channel.id === item.channelId,
						)?.name,
						batchId,
						collectedAt: stamp(),
						status: filtered ? "filtered" : "collected",
						attempts: 0,
					};
					state.messages.push(message);
					currentLog.messageKeys.push(key);
					if (filtered) {
						currentLog.ignored++;
						channelResult.ignored++;
					} else {
						currentLog.saved++;
						channelResult.saved++;
					}
				}
				for (const channel of currentLog.channelResults ?? [])
					channel.status = channel.saved > 0 ? "success" : "skipped";
				current.retryAttempt = 0;
				current.error = undefined;
				current.cursor = result.cursor ?? current.cursor;
				currentLog.status = "success";
				currentLog.finishedAt = stamp();
				currentLog.durationMs = now() - startedAt;
				current.lastRunAt = stamp();
				current.nextRunAt = new Date(
					now() + current.rules.intervalSeconds * 1000,
				).toISOString();
			});
		} catch (error) {
			await store.update((state) => {
				const task = state.tasks.find((t) => t.id === id);
				const log = state.logs.find((l) => l.id === batchId);
				const message = error instanceof Error ? error.message : "采集失败";
				if (task && !controller.signal.aborted) {
					const attempt = log?.attempt ?? 0;
					if (attempt < task.rules.maxRetries) {
						task.retryAttempt = attempt + 1;
						task.nextRunAt = new Date(
							now() + task.rules.retrySeconds * 1000,
						).toISOString();
						if (log) log.retryAt = task.nextRunAt;
					} else {
						task.status = "attention";
					}
					task.error = message;
				}
				if (log) {
					log.status = controller.signal.aborted ? "uncertain" : "failed";
					for (const channel of log.channelResults ?? []) {
						channel.status = "uncertain";
						channel.error = `本轮采集未完成，未取得此频道的完整结果：${message}`;
					}
					log.failed = controller.signal.aborted ? 0 : 1;
					log.error = message;
					log.finishedAt = stamp();
					log.durationMs = now() - startedAt;
				}
			});
		} finally {
			active.delete(id);
		}
	}
	async function tick() {
		const tasks = store
			.read()
			.tasks.filter((t) => t.status === "running" && Date.parse(t.nextRunAt) <= now());
		await Promise.allSettled(tasks.map((task) => run(task.id)));
	}
	return {
		saveTask,
		deleteTask,
		action,
		run,
		tick,
		recover,
		start() {
			if (!timer) {
				timer = setInterval(() => {
					void tick();
				}, 1000);
				void tick();
			}
		},
		async stop() {
			if (timer) clearInterval(timer);
			timer = undefined;
			for (const controller of active.values()) controller.abort();
		},
	};
}
