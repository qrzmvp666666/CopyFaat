import { randomUUID } from "node:crypto";

import {
	taskInputSchema,
	type CollectorResponse,
	type Message,
	type Task,
	type TaskInput,
	type TaskLog,
} from "../shared/contracts";
import type { WebhookDeliveryResult } from "./delivery";
import type { StateStore } from "./store";

export interface EngineDependencies {
	collect(task: Task, signal: AbortSignal): Promise<CollectorResponse>;
	deliver?(task: Task, message: Message, signal: AbortSignal): Promise<WebhookDeliveryResult>;
	finishUnreadChannels?(task: Task, channelIds: string[], signal: AbortSignal): Promise<void>;
	now?: () => number;
}

function keywordList(value: string): string[] {
	return value
		.split(/[,，\n]/)
		.map((keyword) => keyword.trim().toLocaleLowerCase())
		.filter(Boolean);
}

function validateRunnable(task: Task): void {
	if (task.source.platform !== "discord") throw new Error("当前版本仅支持 Discord 采集。");
	if (!task.receiver || task.receiver.platform !== "discord")
		throw new Error("请先为每个来源频道配置 Discord Webhook 地址。");
	const configured = new Set(task.receiver.channels.map((channel) => channel.sourceChannelId));
	if (task.source.channels.some((channel) => !configured.has(channel.id)))
		throw new Error("部分来源频道尚未配置 Webhook，请编辑任务后重试。");
}

function validateRunnableInput(input: TaskInput): void {
	if (input.source.platform !== "discord") throw new Error("当前版本仅支持 Discord 采集。");
	if (!input.receiver || input.receiver.platform !== "discord")
		throw new Error("请先为每个来源频道配置 Discord Webhook 地址。");
	const configured = new Set(input.receiver.channels.map((channel) => channel.sourceChannelId));
	if (input.source.channels.some((channel) => !configured.has(channel.id)))
		throw new Error("部分来源频道尚未配置 Webhook，请编辑任务后重试。");
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
					message.error =
						"应用在发送期间关闭，Discord 是否已接收无法确认；为避免重复未自动重发。";
				}
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
		if (parsed.startPaused === false) validateRunnableInput(parsed);
		active.get(id ?? "")?.abort();
		const taskId = id ?? randomUUID();
		await store.update((state) => {
			const existing = state.tasks.find((task) => task.id === taskId);
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
					status: parsed.startPaused === false ? "running" : "paused",
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
		if (!id && parsed.startPaused === false) {
			const task = store.read().tasks.find((item) => item.id === taskId);
			if (task) validateRunnable(task);
			void run(taskId);
		}
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
			const task = state.tasks.find((item) => item.id === id);
			if (!task) throw new Error("任务不存在");
			if (action !== "pause") validateRunnable(task);
			task.status = action === "pause" ? "paused" : "running";
			task.error = undefined;
			task.retryAttempt = 0;
			task.nextRunAt = stamp();
		});
		if (action !== "pause") void run(id);
	}

	async function deliverPending(taskId: string, logId: string, signal: AbortSignal) {
		if (!deps.deliver) return;
		const task = store.read().tasks.find((item) => item.id === taskId);
		if (!task?.receiver) return;
		const due = store
			.read()
			.messages.filter(
				(message) =>
					message.taskId === taskId &&
					(message.status === "collected" || message.status === "pending") &&
					(!message.nextAttemptAt || Date.parse(message.nextAttemptAt) <= now()),
			)
			.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));

		for (const message of due) {
			if (signal.aborted) break;
			await store.update((state) => {
				const current = state.messages.find((item) => item.key === message.key);
				if (!current || (current.status !== "collected" && current.status !== "pending"))
					return;
				current.status = "sending";
				current.attempts++;
				current.error = undefined;
				current.nextAttemptAt = undefined;
			});
			const result: WebhookDeliveryResult = await deps
				.deliver(task, message, signal)
				.catch((error) => ({
					status: "uncertain" as const,
					error: error instanceof Error ? error.message : "发送未取得确认。",
				}));
			await store.update((state) => {
				const current = state.messages.find((item) => item.key === message.key);
				if (!current || current.status !== "sending") return;
				const retrying =
					result.status === "retry" && message.attempts + 1 <= task.rules.maxRetries;
				applyDeliveryResult(current, result, task.rules.maxRetries, now());
				const currentLog = state.logs.find((item) => item.id === logId);
				if (!currentLog) return;
				if (result.httpStatus) currentLog.httpStatus = result.httpStatus;
				if (result.status !== "sent") {
					const channel = currentLog.channelResults?.find(
						(item) => item.channelId === current.channelId,
					);
					if (channel) {
						channel.status = retrying
							? "retrying"
							: result.status === "uncertain"
								? "uncertain"
								: "failed";
						if (!retrying) channel.failed++;
						channel.error = result.error;
					}
					currentLog.error = result.error;
					if (!retrying) currentLog.failed++;
					currentLog.status = "partial";
				}
			});
		}
	}

	async function run(id: string) {
		if (active.has(id)) return;
		const controller = new AbortController();
		active.set(id, controller);
		const startedAt = now();
		const batchId = randomUUID();
		let log: TaskLog | undefined;
		try {
			const task = store.read().tasks.find((item) => item.id === id);
			if (!task || task.status !== "running") return;
			validateRunnable(task);
			log = {
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
			await store.update((state) => state.logs.push(log!));

			const result = await deps.collect(task, controller.signal);
			if (controller.signal.aborted) throw new Error("采集已取消");
			const selectedIds = new Set(task.source.channels.map((channel) => channel.id));
			if (result.messages.some((message) => !selectedIds.has(message.channelId)))
				throw new Error("采集程序返回了当前任务范围以外的频道，已拒绝此批次");
			if (result.channels.some((channel) => !selectedIds.has(channel.channelId)))
				throw new Error("采集程序返回了当前任务范围以外的频道状态，已拒绝此批次");

			const included = keywordList(task.rules.include);
			const excluded = keywordList(task.rules.exclude);
			const finishChannelIds: string[] = [];
			await store.update((state) => {
				const current = state.tasks.find((item) => item.id === id);
				if (!current || current.status !== "running" || controller.signal.aborted)
					throw new Error("采集已取消");
				const seen = new Set(state.messages.map((message) => message.key));
				const currentLog = state.logs.find((item) => item.id === batchId)!;
				currentLog.collected = result.messages.length;
				for (const channel of result.channels) {
					const channelResult = currentLog.channelResults!.find(
						(item) => item.channelId === channel.channelId,
					)!;
					if (channel.status === "skipped_read") channelResult.status = "skipped_read";
					else if (channel.status === "failed") {
						channelResult.status = "failed";
						channelResult.error = channel.error ?? "频道读取失败";
						channelResult.failed++;
						currentLog.failed++;
					}
					if (channel.status === "unread") finishChannelIds.push(channel.channelId);
				}
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
					const normalizedText = item.text.toLocaleLowerCase();
					const allowedTime = Date.parse(item.sentAt) >= Date.parse(task.rules.startAt);
					const matchesInclude =
						included.length === 0 ||
						included.some((keyword) => normalizedText.includes(keyword));
					const matchesExclude = excluded.some((keyword) =>
						normalizedText.includes(keyword),
					);
					const attachments = item.attachments.filter((attachment) =>
						attachment.kind === "image" ? task.rules.images : task.rules.attachments,
					);
					const mediaLabels = item.mediaLabels.filter((media) =>
						media.kind === "image" ? task.rules.images : task.rules.attachments,
					);
					const text = task.rules.text ? item.text : "";
					const filtered =
						!allowedTime ||
						!matchesInclude ||
						matchesExclude ||
						(!text && !attachments.length && !mediaLabels.length);
					const message: Message = {
						...item,
						text,
						attachments,
						mediaLabels,
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
				for (const channel of currentLog.channelResults ?? []) {
					if (channel.status === "processing")
						channel.status = channel.saved > 0 ? "success" : "skipped";
				}
				current.retryAttempt = 0;
				current.error = undefined;
				current.cursor = result.cursor ?? current.cursor;
				currentLog.status = currentLog.failed ? "partial" : "success";
				currentLog.finishedAt = stamp();
				currentLog.durationMs = now() - startedAt;
				current.lastRunAt = stamp();
				current.nextRunAt = new Date(
					now() + current.rules.intervalSeconds * 1000,
				).toISOString();
			});

			await deliverPending(id, batchId, controller.signal);
			await store.update((state) => {
				const currentLog = state.logs.find((item) => item.id === batchId);
				if (!currentLog) return;
				if (currentLog.failed > 0 && currentLog.status === "success")
					currentLog.status = "partial";
				const current = state.tasks.find((item) => item.id === id);
				if (current) {
					const nextRetry = state.messages
						.filter(
							(message) =>
								message.taskId === id &&
								message.status === "pending" &&
								message.nextAttemptAt,
						)
						.map((message) => Date.parse(message.nextAttemptAt!))
						.filter((time) => time > now())
						.sort((a, b) => a - b)[0];
					if (nextRetry && nextRetry < Date.parse(current.nextRunAt))
						current.nextRunAt = new Date(nextRetry).toISOString();
				}
				currentLog.finishedAt = stamp();
				currentLog.durationMs = now() - startedAt;
			});

			if (task.rules.markRead && deps.finishUnreadChannels && !controller.signal.aborted) {
				const persistedChannels = finishChannelIds.filter((channelId) => {
					const channelMessages = store
						.read()
						.messages.filter(
							(message) => message.taskId === id && message.channelId === channelId,
						);
					return channelMessages.every(
						(message) => message.status === "synced" || message.status === "filtered",
					);
				});
				try {
					await deps.finishUnreadChannels(task, persistedChannels, controller.signal);
				} catch (error) {
					await store.update((state) => {
						const currentLog = state.logs.find((item) => item.id === batchId);
						if (currentLog)
							currentLog.error = `消息已保存，但滚动到最新位置失败：${error instanceof Error ? error.message : "未知错误"}`;
					});
				}
			}
		} catch (error) {
			await store.update((state) => {
				const task = state.tasks.find((item) => item.id === id);
				const currentLog = state.logs.find((item) => item.id === batchId);
				const message = error instanceof Error ? error.message : "采集失败";
				for (const item of state.messages)
					if (item.taskId === id && item.status === "sending") {
						item.status = "uncertain";
						item.error = "发送中断，是否已送达无法确认；为避免重复未自动重发。";
					}
				if (task && !controller.signal.aborted) {
					const attempt = currentLog?.attempt ?? 0;
					if (attempt < task.rules.maxRetries) {
						task.retryAttempt = attempt + 1;
						task.nextRunAt = new Date(
							now() + task.rules.retrySeconds * 1000,
						).toISOString();
						if (currentLog) currentLog.retryAt = task.nextRunAt;
					} else {
						task.status = "attention";
					}
					task.error = message;
				}
				if (currentLog) {
					currentLog.status = controller.signal.aborted ? "uncertain" : "failed";
					for (const channel of currentLog.channelResults ?? []) {
						if (channel.status === "processing") {
							channel.status = controller.signal.aborted ? "uncertain" : "failed";
							channel.error = `本轮采集未完成：${message}`;
						}
					}
					currentLog.failed++;
					currentLog.error = message;
					currentLog.finishedAt = stamp();
					currentLog.durationMs = now() - startedAt;
				}
			});
		} finally {
			active.delete(id);
		}
	}

	async function tick() {
		const tasks = store
			.read()
			.tasks.filter(
				(task) => task.status === "running" && Date.parse(task.nextRunAt) <= now(),
			);
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
				timer = setInterval(() => void tick(), 1000);
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

function applyDeliveryResult(
	message: Message,
	result: WebhookDeliveryResult,
	maxRetries: number,
	now: number,
) {
	message.error = result.error;
	if (result.status === "sent") {
		message.status = "synced";
		message.syncedAt = new Date(now).toISOString();
	} else if (result.status === "retry" && message.attempts <= maxRetries) {
		message.status = "pending";
		message.nextAttemptAt = new Date(now + (result.retryAfterMs ?? 5000)).toISOString();
	} else {
		message.status = result.status === "uncertain" ? "uncertain" : "failed";
	}
}
