import type { ChannelResult, Message, PublicState, TaskLog } from "../../shared/contracts";

export interface ChannelEntry {
	key: string;
	taskId: string;
	channelId: string;
	name: string;
	taskName: string;
	serverName: string;
	platform: "discord" | "telegram";
	count: number;
}
export interface ChannelLogRow {
	key: string;
	log: TaskLog;
	result?: ChannelResult;
	channel?: ChannelEntry;
	status: "processing" | "success" | "skipped" | "failed" | "uncertain" | "retrying";
	legacy: boolean;
}
export function channelKey(taskId: string, channelId: string): string {
	return JSON.stringify([taskId, channelId]);
}
export function getChannels(state: PublicState, taskId?: string): ChannelEntry[] {
	const entries = new Map<string, ChannelEntry>();
	function add(
		task: string,
		id: string,
		name: string,
		taskName: string,
		serverName: string,
		platform: ChannelEntry["platform"],
	) {
		const key = channelKey(task, id);
		if (!entries.has(key))
			entries.set(key, {
				key,
				taskId: task,
				channelId: id,
				name,
				taskName,
				serverName,
				platform,
				count: 0,
			});
	}
	for (const task of state.tasks) {
		if (taskId && task.id !== taskId) continue;
		for (const channel of task.source.channels)
			add(
				task.id,
				channel.id,
				channel.name,
				task.name,
				task.source.server.name,
				task.source.platform,
			);
	}
	for (const log of state.logs) {
		if (taskId && log.taskId !== taskId) continue;
		for (const channel of log.channelResults ?? [])
			add(
				log.taskId,
				channel.channelId,
				channel.channelName,
				log.taskName ?? "已删除的任务",
				log.sourceName ?? "历史来源",
				log.platform ?? "discord",
			);
	}
	for (const message of state.messages) {
		if (taskId && message.taskId !== taskId) continue;
		add(
			message.taskId,
			message.channelId,
			message.channelName ?? message.channelId,
			message.taskName ?? "已删除的任务",
			message.sourceName ?? "历史来源",
			message.platform ?? "discord",
		);
		if (message.status !== "filtered")
			entries.get(channelKey(message.taskId, message.channelId))!.count++;
	}
	return [...entries.values()];
}
export function messageInChannel(message: Message, channel?: ChannelEntry): boolean {
	return (
		!channel || (message.taskId === channel.taskId && message.channelId === channel.channelId)
	);
}
export function getChannelLogs(
	state: PublicState,
	taskId?: string,
	channel?: ChannelEntry,
): ChannelLogRow[] {
	const channels = getChannels(state, taskId);
	const rows: ChannelLogRow[] = [];
	for (const log of state.logs) {
		if (
			log.phase !== "collect" ||
			(taskId && log.taskId !== taskId) ||
			(channel && log.taskId !== channel.taskId)
		)
			continue;
		const task = state.tasks.find((task) => task.id === log.taskId);
		const retrying = Boolean(
			log.retryAt &&
			task?.status === "running" &&
			task.nextRunAt === log.retryAt &&
			task.retryAttempt === (log.attempt ?? 0) + 1,
		);
		if (log.channelResults) {
			for (const result of log.channelResults) {
				if (channel && result.channelId !== channel.channelId) continue;
				rows.push({
					key: `${log.id}:${result.channelId}`,
					log,
					result,
					channel: channels.find(
						(entry) =>
							entry.taskId === log.taskId && entry.channelId === result.channelId,
					),
					status: retrying
						? "retrying"
						: log.status === "failed"
							? "failed"
							: result.status,
					legacy: false,
				});
			}
		} else {
			const related = state.messages.some(
				(message) =>
					messageInChannel(message, channel) &&
					message.taskId === log.taskId &&
					(message.batchId === log.id || log.messageKeys.includes(message.key)),
			);
			if (channel && !(log.channelIds?.includes(channel.channelId) || related)) continue;
			rows.push({
				key: log.id,
				log,
				status: retrying ? "retrying" : log.status === "partial" ? "uncertain" : log.status,
				channel,
				legacy: true,
			});
		}
	}
	return rows.sort((a, b) => Date.parse(b.log.startedAt) - Date.parse(a.log.startedAt));
}
