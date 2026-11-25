import { randomUUID } from "node:crypto";

import {
	taskInputSchema,
	type CollectorResponse,
	type DeliveryResult,
	type Message,
	type Task,
	type TaskInput,
	type TaskLog,
} from "../shared/contracts";
import type { StateStore } from "./store";

export interface EngineDependencies {
	collect(task: Task, signal: AbortSignal): Promise<CollectorResponse>;
	deliver(task: Task, message: Message, signal: AbortSignal): Promise<DeliveryResult>;
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
				if (message.status === "sending") {
					message.status = "uncertain";
					message.error = "上次发送中断，需核对目标回执后处理";
					const task = state.tasks.find((t) => t.id === message.taskId);
					if (task) {
						task.status = "attention";
						task.error = message.error;
					}
				}
			for (const log of state.logs)
				if (log.status === "processing") {
					log.status = "uncertain";
					log.finishedAt = stamp();
					log.error = "上次执行中断，未取得完整结果";
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
	async function action(id: string, action: "pause" | "resume" | "run") {
		if (action === "pause") active.get(id)?.abort();
		await store.update((state) => {
			const task = state.tasks.find((t) => t.id === id);
			if (!task) throw new Error("任务不存在");
			if (
				action !== "pause" &&
				state.messages.some((m) => m.taskId === id && m.status === "uncertain")
			)
				throw new Error("有送达状态未确认的消息，请先核对并处理");
			task.status = action === "pause" ? "paused" : "running";
			task.error = undefined;
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
				if (!current || current.status !== "running" || controller.signal.aborted) return;
				const seen = new Set(state.messages.map((m) => m.key));
				const currentLog = state.logs.find((l) => l.id === batchId)!;
				currentLog.collected = result.messages.length;
				for (const item of result.messages) {
					const key = `${id}:${item.channelId}:${item.id}`;
					if (seen.has(key)) {
						currentLog.ignored++;
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
						batchId,
						collectedAt: stamp(),
						status: filtered ? "filtered" : "pending",
						attempts: 0,
					};
					state.messages.push(message);
					currentLog.messageKeys.push(key);
					if (filtered) currentLog.ignored++;
				}
				current.cursor = result.cursor ?? current.cursor;
			});
			for (const message of store
				.read()
				.messages.filter(
					(m) =>
						m.taskId === id &&
						["pending", "failed"].includes(m.status) &&
						(!m.nextAttemptAt || Date.parse(m.nextAttemptAt) <= now()) &&
						m.attempts <= task.rules.maxRetries,
				)) {
				if (
					controller.signal.aborted ||
					store.read().tasks.find((t) => t.id === id)?.status !== "running"
				)
					break;
				const logId = randomUUID();
				await store.update((state) => {
					const current = state.messages.find((m) => m.key === message.key)!;
					current.status = "sending";
					current.attempts++;
					state.logs.push({
						id: logId,
						taskId: id,
						phase: "sync",
						status: "processing",
						startedAt: stamp(),
						collected: 0,
						saved: 0,
						ignored: 0,
						failed: 0,
						messageKeys: [message.key],
					});
				});
				let receipt: DeliveryResult;
				try {
					receipt = await deps.deliver(task, message, controller.signal);
				} catch (error) {
					receipt = {
						state: "failed",
						error: error instanceof Error ? error.message : "同步配置无效",
					};
				}
				await store.update((state) => {
					const current = state.messages.find((m) => m.key === message.key)!;
					const currentLog = state.logs.find((l) => l.id === logId)!;
					current.status = receipt.state === "confirmed" ? "synced" : receipt.state;
					current.error = receipt.error;
					current.remoteLogId = receipt.remoteLogId;
					if (receipt.state === "confirmed") current.syncedAt = stamp();
					else
						current.nextAttemptAt = new Date(
							now() + task.rules.retrySeconds * 1000,
						).toISOString();
					Object.assign(currentLog, {
						status: receipt.state === "confirmed" ? "success" : receipt.state,
						finishedAt: stamp(),
						saved: receipt.state === "confirmed" ? 1 : 0,
						failed: receipt.state === "confirmed" ? 0 : 1,
						httpStatus: receipt.httpStatus,
						error: receipt.error,
						remoteLogId: receipt.remoteLogId,
					});
					if (
						receipt.state === "uncertain" ||
						(receipt.state === "failed" && current.attempts > task.rules.maxRetries)
					) {
						const currentTask = state.tasks.find((t) => t.id === id)!;
						currentTask.status = "attention";
						currentTask.error = receipt.error;
					}
				});
			}
			await store.update((state) => {
				const log = state.logs.find((l) => l.id === batchId);
				const task = state.tasks.find((t) => t.id === id);
				if (log) {
					log.status = "success";
					log.finishedAt = stamp();
					log.durationMs = now() - startedAt;
				}
				if (task) {
					task.lastRunAt = stamp();
					task.nextRunAt = new Date(
						now() + task.rules.intervalSeconds * 1000,
					).toISOString();
				}
			});
		} catch (error) {
			await store.update((state) => {
				const task = state.tasks.find((t) => t.id === id);
				const log = state.logs.find((l) => l.id === batchId);
				const message = error instanceof Error ? error.message : "采集失败";
				if (task && !controller.signal.aborted) {
					task.status = "attention";
					task.error = message;
				}
				if (log) {
					log.status = "failed";
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
