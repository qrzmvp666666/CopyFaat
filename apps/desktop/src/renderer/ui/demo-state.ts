import type { Message, PublicState, PublicTask, TaskLog } from "../../shared/contracts";

// Renderer-only fixtures: these tasks are never registered with the collection engine.
export function createDemoState(now = new Date()): PublicState {
	function ago(minutes: number) {
		return new Date(now.getTime() - minutes * 60_000).toISOString();
	}
	const tasks: PublicTask[] = [
		{
			id: "demo-market",
			name: "市场观察",
			status: "running",
			source: {
				platform: "discord",
				server: { id: "demo-research", name: "交易研究室（演示）" },
				channels: [
					{ id: "demo-btc", name: "btc-行情" },
					{ id: "demo-eth", name: "eth-观察" },
					{ id: "demo-news", name: "市场快讯" },
				],
			},
		},
		{
			id: "demo-community",
			name: "社区精选",
			status: "paused",
			source: {
				platform: "telegram",
				server: { id: "demo-community-group", name: "CopyFast 社区（演示）" },
				channels: [
					{ id: "demo-discussion", name: "每日讨论" },
					{ id: "demo-resources", name: "资料分享" },
				],
			},
		},
		{
			id: "demo-announcements",
			name: "项目公告",
			status: "attention",
			error: "演示异常：来源窗口不可见，请打开 Discord 后重试。",
			source: {
				platform: "discord",
				server: { id: "demo-project", name: "产品动态（演示）" },
				channels: [{ id: "demo-updates", name: "更新公告" }],
			},
		},
	].map((task) => ({
		...task,
		collector: { executable: "demo-preview-only", args: [] },
		rules: {
			intervalSeconds: 60,
			startAt: ago(2880),
			include: "",
			exclude: "广告,推广",
			maxRetries: 3,
			retrySeconds: 10,
			text: true,
			images: true,
			attachments: true,
		},
		createdAt: ago(2880),
		lastRunAt: ago(2),
		nextRunAt: ago(-1),
	})) as PublicTask[];
	const samples = [
		[
			"林舟",
			"【模拟消息】早间行情复盘已整理。今天重点观察成交量与区间变化，详细记录见本频道。",
		],
		["Mia", "【模拟消息】补充一个观察：短周期波动加大，先记录趋势变化，晚间再统一复盘。"],
		[
			"Alex",
			"【模拟消息】本周研究笔记已更新，包含关键事件、市场情绪和待验证的假设。\n欢迎在讨论区补充自己的观察。",
		],
		[
			"小北",
			"【模拟消息】整理了一份频道精选资料，附件是演示用的文件名称，可以点击消息查看详情。",
		],
		["Chen", "【模拟消息】收到，已加入观察列表。下一轮复盘会对比今天和昨天的数据。"],
		[
			"研究助手",
			"【模拟消息】每日摘要：已完成资讯归档、重复内容去除和频道分类。以下内容仅用于页面效果预览。",
		],
	] as const;
	const messages: Message[] = [];
	const logs: TaskLog[] = [];
	for (const [taskIndex, task] of tasks.entries()) {
		for (const [channelIndex, channel] of task.source.channels.entries()) {
			// Keep one channel empty so its empty state can also be previewed.
			const count = channel.id === "demo-updates" ? 0 : 10 + channelIndex * 2;
			for (let index = 0; index < count; index++) {
				const [author, text] = samples[(index + channelIndex + taskIndex) % samples.length];
				const historical = index >= count - 3;
				messages.push({
					id: `${channel.id}-${index + 1}`,
					key: `${task.id}:${channel.id}:${index + 1}`,
					taskId: task.id,
					taskName: task.name,
					platform: task.source.platform,
					sourceName: task.source.server.name,
					channelId: channel.id,
					channelName: channel.name,
					author,
					text,
					sentAt: ago(historical ? 1440 + index * 7 : 3 + index * 6 + channelIndex),
					collectedAt: ago(historical ? 1440 : 2),
					batchId: `${channel.id}-${historical ? "yesterday" : "latest"}`,
					attachments:
						index === 3
							? [
									{
										url: "https://example.invalid/demo/research-notes.pdf",
										name: "研究笔记（演示附件）.pdf",
										kind: "file",
									},
								]
							: [],
					status: "collected",
					attempts: 0,
				});
			}
			for (const historical of [true, false]) {
				const id = `${channel.id}-${historical ? "yesterday" : "latest"}`;
				const batch = messages.filter((message) => message.batchId === id);
				const failed = task.status === "attention" && !historical;
				const ignored = count > 0 && !historical ? 2 : 0;
				logs.push({
					id,
					taskId: task.id,
					taskName: task.name,
					sourceName: task.source.server.name,
					platform: task.source.platform,
					phase: "collect",
					status: failed ? "failed" : "success",
					startedAt: ago(historical ? 1440.1 : 2.1),
					finishedAt: ago(historical ? 1440 : 2),
					durationMs: 6000,
					collected: batch.length + ignored,
					saved: batch.length,
					ignored,
					failed: 0,
					messageKeys: batch.map((message) => message.key),
					channelIds: [channel.id],
					error: failed ? task.error : undefined,
					channelResults: [
						{
							channelId: channel.id,
							channelName: channel.name,
							status: failed ? "failed" : batch.length ? "success" : "skipped",
							collected: batch.length + ignored,
							saved: batch.length,
							ignored,
							failed: 0,
							error: failed ? task.error : undefined,
						},
					],
				});
			}
		}
	}
	return { version: 1, tasks, messages, logs };
}
