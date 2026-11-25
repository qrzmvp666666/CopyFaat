import {
	ChevronDown,
	CircleAlert,
	Crown,
	ExternalLink,
	Filter,
	List,
	Pause,
	Play,
	Plus,
	RefreshCw,
	Settings2,
	Trash2,
	UserRound,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { PublicState, PublicTask, RuntimeInfo } from "../../shared/contracts";
import type { TaskInput } from "../../shared/contracts";
import { Connections } from "./Connections";
import { TaskDialog } from "./TaskDialog";

const emptyState: PublicState = { version: 1, tasks: [], messages: [], logs: [] };
type DisplayTask = {
	id: string;
	name: string;
	platform: "discord" | "telegram";
	status: "running" | "paused" | "attention";
	source: string;
	target: string;
	lastRunAt: string;
};
const sampleTasks: DisplayTask[] = [
	{
		id: "sample-dc",
		name: "产品更新汇总",
		platform: "discord",
		status: "running",
		source: "产品社区 · 3 个频道",
		target: "DC / 我的工作室 / #产品资讯",
		lastRunAt: "刚刚",
	},
	{
		id: "sample-tg",
		name: "行业快讯",
		platform: "telegram",
		status: "running",
		source: "行业观察 · 2 个频道",
		target: "TG / 我的资讯 / #行业快讯",
		lastRunAt: "12 秒前",
	},
	{
		id: "sample-error",
		name: "团队公告",
		platform: "discord",
		status: "attention",
		source: "团队空间 · 1 个频道",
		target: "TG / 我的资讯 / #团队公告",
		lastRunAt: "3 分钟前",
	},
	{
		id: "sample-community",
		name: "社区公告同步",
		platform: "discord",
		status: "running",
		source: "开发者社区 · 2 个频道",
		target: "DC / 我的工作室 / #社区公告",
		lastRunAt: "14:30:12",
	},
	{
		id: "sample-overseas",
		name: "海外资讯",
		platform: "telegram",
		status: "running",
		source: "海外资讯 · 1 个频道",
		target: "DC / 我的工作室 / #海外资讯",
		lastRunAt: "14:31:22",
	},
	{
		id: "sample-events",
		name: "活动通知",
		platform: "telegram",
		status: "paused",
		source: "活动频道 · 1 个频道",
		target: "DC / 我的工作室 / #活动",
		lastRunAt: "昨天",
	},
];

type MessageRow = {
	id: string;
	taskId: string;
	taskName: string;
	platform: "discord" | "telegram";
	source: string;
	author: string;
	time: string;
	text: string;
	target: string;
	status: string;
};

const previewMessages: MessageRow[] = [
	{
		id: "preview-1",
		taskId: "sample-tg",
		taskName: "行业快讯",
		platform: "telegram",
		source: "行业观察 / #行业快讯",
		author: "Atlas",
		time: "14:32:08",
		text: "本周产品更新已发布，完整更新说明见频道置顶。",
		target: "my-tg / #行业快讯",
		status: "synced",
	},
	{
		id: "preview-6",
		taskId: "sample-tg",
		taskName: "行业快讯",
		platform: "telegram",
		source: "行业观察 / #行业快讯",
		author: "Nova",
		time: "14:31:08",
		text: "社区文档更新完成，请使用最新链接。",
		target: "my-tg / #行业快讯",
		status: "synced",
	},
	{
		id: "preview-7",
		taskId: "sample-tg",
		taskName: "行业快讯",
		platform: "telegram",
		source: "行业观察 / #行业快讯",
		author: "Nova",
		time: "14:30:08",
		text: "开发者活动报名入口已更新。",
		target: "my-tg / #行业快讯",
		status: "synced",
	},
	{
		id: "preview-2",
		taskId: "sample-dc",
		taskName: "产品更新汇总",
		platform: "discord",
		source: "产品社区 / #产品更新",
		author: "Mia",
		time: "14:31:45",
		text: "桌面端新增多频道选择，现已开放测试。",
		target: "my-dc / #产品资讯",
		status: "synced",
	},
	{
		id: "preview-3",
		taskId: "sample-overseas",
		taskName: "海外资讯",
		platform: "telegram",
		source: "海外资讯 / #news",
		author: "Nova",
		time: "14:31:22",
		text: "开发者活动将于周五开始，报名入口已更新。",
		target: "my-dc / #海外资讯",
		status: "pending",
	},
	{
		id: "preview-4",
		taskId: "sample-error",
		taskName: "团队公告",
		platform: "discord",
		source: "团队空间 / #公告",
		author: "Alex",
		time: "14:30:52",
		text: "团队周会记录已整理，请在本周内确认。",
		target: "my-tg / #团队公告",
		status: "failed",
	},
	{
		id: "preview-5",
		taskId: "sample-community",
		taskName: "社区公告同步",
		platform: "discord",
		source: "开发者社区 / #公告",
		author: "Ryan",
		time: "14:30:12",
		text: "社区文档更新完成，请使用最新链接。",
		target: "my-dc / #社区公告",
		status: "synced",
	},
];
function toDisplayTask(task: PublicTask): DisplayTask {
	return {
		id: task.id,
		name: task.name,
		platform: task.source.platform,
		status: task.status,
		source: `${task.source.server.name} · ${task.source.channels.length} 个频道`,
		target: `${task.target.server.name} · ${task.target.channels.length} 个频道`,
		lastRunAt: task.lastRunAt ? new Date(task.lastRunAt).toLocaleTimeString() : "未运行",
	};
}

export function App() {
	const [state, setState] = useState<PublicState>(emptyState);
	const [page, setPage] = useState<"workspace" | "connections">("workspace");
	const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo>();
	const [isCheckingRuntime, setIsCheckingRuntime] = useState(false);
	const [connectionMessage, setConnectionMessage] = useState<string>();
	const [setupDismissed, setSetupDismissed] = useState(
		() => localStorage.getItem("copyfast-setup-dismissed") === "true",
	);
	const [onboardingOpen, setOnboardingOpen] = useState(
		() => localStorage.getItem("copyfast-onboarding-complete") !== "true",
	);
	const [tab, setTab] = useState("messages");
	const [selected, setSelected] = useState<string>();
	const [activeMessageId, setActiveMessageId] = useState<string>();
	const [createOpen, setCreateOpen] = useState(false);
	const [accountPanel, setAccountPanel] = useState<"profile" | "membership" | null>(null);
	const [prototypeTasks, setPrototypeTasks] = useState<PublicTask[]>([]);
	const [taskStatusOverrides, setTaskStatusOverrides] = useState<
		Record<string, DisplayTask["status"]>
	>({});
	const [deletedTaskIds, setDeletedTaskIds] = useState<string[]>([]);
	useEffect(() => {
		void window.copyfast.state().then(setState);
		return window.copyfast.onState(setState);
	}, []);
	useEffect(
		() =>
			window.copyfast.onNavigate((target) => {
				setPage("workspace");
				if (target.tab) setTab(target.tab);
				if (target.taskId) {
					setSelected(target.taskId);
					setActiveMessageId(undefined);
				}
			}),
		[],
	);
	useEffect(() => {
		if (page !== "connections") return;
		let cancelled = false;
		setIsCheckingRuntime(true);
		void window.copyfast
			.runtime()
			.then((info) => {
				if (!cancelled) setRuntimeInfo(normalizeRuntimeInfo(info));
			})
			.catch(() => {
				if (!cancelled) setConnectionMessage("暂时无法读取本机状态，请稍后重试。");
			})
			.finally(() => {
				if (!cancelled) setIsCheckingRuntime(false);
			});
		return () => {
			cancelled = true;
		};
	}, [page]);
	function completeOnboarding() {
		setOnboardingOpen(false);
		localStorage.setItem("copyfast-onboarding-complete", "true");
	}
	async function checkRuntime() {
		setIsCheckingRuntime(true);
		setConnectionMessage(undefined);
		try {
			setRuntimeInfo(normalizeRuntimeInfo(await window.copyfast.runtime()));
		} catch {
			setConnectionMessage("暂时无法读取本机状态，请稍后重试。");
		} finally {
			setIsCheckingRuntime(false);
		}
	}
	async function launchDesktopApp(target: "telegram" | "discord") {
		setConnectionMessage(undefined);
		try {
			const launched = await window.copyfast.launchDesktopApp(target);
			if (!launched) setConnectionMessage("未能启动应用，请检查安装状态后重试。");
		} catch {
			setConnectionMessage("未能启动应用，请稍后重试。");
		}
		await checkRuntime();
	}
	async function requestPermission() {
		setConnectionMessage(undefined);
		try {
			const granted = await window.copyfast.requestAccessibilityPermission();
			if (!granted)
				setConnectionMessage("请在系统设置中允许 CopyFast 控制桌面，然后重新检测。");
		} catch {
			setConnectionMessage("无法打开系统设置，请手动检查桌面操作权限。");
		}
		await checkRuntime();
	}
	function dismissSetup() {
		setSetupDismissed(true);
		localStorage.setItem("copyfast-setup-dismissed", "true");
	}
	const baseTasks = state.tasks.length
		? state.tasks.map(toDisplayTask)
		: [...prototypeTasks.map(toDisplayTask), ...sampleTasks];
	const tasks = baseTasks
		.filter((task) => !deletedTaskIds.includes(task.id))
		.map((task) => ({ ...task, status: taskStatusOverrides[task.id] ?? task.status }));
	const total = tasks.length;
	const running = tasks.filter((t) => t.status === "running").length;
	const attention = tasks.filter((t) => t.status === "attention").length;
	const current = tasks.find((t) => t.id === selected) ?? tasks[0];
	const currentTask =
		state.tasks.find((t) => t.id === current?.id) ??
		prototypeTasks.find((t) => t.id === current?.id) ??
		state.tasks[0];
	const selectedTask =
		selected && current
			? {
					id: current.id,
					name: current.name,
					platform: current.platform,
					channelCount:
						currentTask?.source.channels.length ??
						Number(current.source.match(/(\d+) 个频道/)?.[1] ?? 0),
				}
			: undefined;
	const isPreview =
		state.tasks.length === 0 &&
		state.messages.length === 0 &&
		state.logs.length === 0 &&
		prototypeTasks.length === 0;
	const selectedMessages = selectedTask
		? isPreview
			? previewMessages.filter((message) => message.taskId === selectedTask.id)
			: state.messages.filter((message) => message.taskId === selectedTask.id)
		: [];
	const selectedAttention = selectedMessages.filter((message) =>
		["failed", "uncertain", "pending"].includes(message.status),
	).length;
	return (
		<main className={`app-shell${onboardingOpen ? " onboarding-open" : ""}`}>
			<header className="titlebar">
				<span className="traffic" aria-hidden="true" />
				<div className="header-actions">
					<button
						className="header-action header-icon-action"
						aria-label="个人中心"
						aria-expanded={accountPanel === "profile"}
						aria-haspopup="dialog"
						title="个人中心"
						onClick={() =>
							setAccountPanel(accountPanel === "profile" ? null : "profile")
						}
					>
						<UserRound size={16} />
					</button>
					<button
						className="header-action header-icon-action membership-action"
						aria-label="会员权益"
						aria-expanded={accountPanel === "membership"}
						aria-haspopup="dialog"
						title="会员权益"
						onClick={() =>
							setAccountPanel(accountPanel === "membership" ? null : "membership")
						}
					>
						<Crown size={16} />
					</button>
					{accountPanel && (
						<div
							className="account-popover"
							role="dialog"
							aria-label={accountPanel === "profile" ? "个人中心" : "会员权益"}
						>
							<div className="account-popover-heading">
								<strong>
									{accountPanel === "profile" ? "个人中心" : "会员权益"}
								</strong>
								<button aria-label="关闭" onClick={() => setAccountPanel(null)}>
									<X size={14} />
								</button>
							</div>
							<p>
								{accountPanel === "profile"
									? "账户资料与设置将在账户服务接入后开放。"
									: "会员方案与专属权益将在后端接入后开放。"}
							</p>
						</div>
					)}
				</div>
			</header>
			<div className="workspace">
				<aside className="sidebar">
					<div className="brand">
						<span className="brand-mark">CF</span> CopyFast
					</div>
					<div className="eyebrow">工作台</div>
					<button
						type="button"
						className={
							page === "workspace" && !selectedTask
								? "nav-active"
								: "nav-active task-context"
						}
						onClick={() => {
							setPage("workspace");
							setSelected(undefined);
							setActiveMessageId(undefined);
						}}
					>
						<List size={16} />
						采集工作台
					</button>
					<button
						type="button"
						className={page === "connections" ? "nav-active" : "nav-muted"}
						onClick={() => {
							completeOnboarding();
							setSelected(undefined);
							setActiveMessageId(undefined);
							setPage("connections");
						}}
					>
						<Settings2 size={16} />
						连接与权限
					</button>
					<div className="task-label">
						全部任务 <span>{total}</span>
						<button aria-label="新建采集任务" onClick={() => setCreateOpen(true)}>
							<Plus size={16} />
						</button>
					</div>
					<div className="task-list">
						{tasks.map((task) => (
							<button
								className={selected === task.id ? "task-selected" : ""}
								key={task.id}
								onClick={() => {
									setPage("workspace");
									completeOnboarding();
									setSelected(task.id);
									setActiveMessageId(undefined);
								}}
							>
								<i className={`platform ${task.platform}`}>
									{task.platform === "telegram" ? "TG" : "DC"}
								</i>
								{task.name}
							</button>
						))}
					</div>
					<div className="sidebar-bottom">
						<div className="eyebrow">桌面应用</div>
						<div className="connection">
							<b>TG</b>Telegram{" "}
							<small>
								{runtimeInfo
									? runtimeInfo.apps.telegram
										? "已安装"
										: "未安装"
									: "未检测"}
							</small>
						</div>
						<div className="connection">
							<b>DC</b>Discord{" "}
							<small>
								{runtimeInfo
									? runtimeInfo.apps.discord
										? "已安装"
										: "未安装"
									: "未检测"}
							</small>
						</div>
						<button
							className="support"
							onClick={() => window.copyfast.openExternal("support")}
						>
							<ExternalLink size={14} />
							Telegram 客服
						</button>
					</div>
				</aside>
				{page === "connections" ? (
					<Connections
						runtimeInfo={runtimeInfo}
						isChecking={isCheckingRuntime}
						actionMessage={connectionMessage}
						setupDismissed={setupDismissed}
						onCheck={() => void checkRuntime()}
						onLaunchApp={(target) => void launchDesktopApp(target)}
						onRequestPermission={() => void requestPermission()}
						onDismissSetup={dismissSetup}
						onReturnToWorkspace={() => {
							completeOnboarding();
							setPage("workspace");
						}}
					/>
				) : (
					<section className="content">
						<div className="content-head">
							<div>
								<div className="eyebrow">
									{selectedTask
										? `任务 / ${selectedTask.platform === "telegram" ? "Telegram" : "Discord"}`
										: "工作区 / 采集与同步"}
								</div>
								<h1>{selectedTask?.name ?? "采集工作台"}</h1>
								<p>
									{selectedTask
										? `${current?.source ?? "任务来源未配置"} · ${current?.target ?? "同步目标未配置"}`
										: "统一查看多平台采集结果，追踪每一次采集与同步。"}
								</p>
							</div>
							<div className="content-head-actions">
								{selectedTask && current && (
									<>
										<button
											className="secondary"
											title={
												current.status === "running"
													? "暂停任务"
													: "运行任务"
											}
											onClick={() =>
												setTaskStatusOverrides((statuses) => ({
													...statuses,
													[current.id]:
														current.status === "running"
															? "paused"
															: "running",
												}))
											}
										>
											{current.status === "running" ? (
												<Pause size={15} />
											) : (
												<Play size={15} />
											)}
											{current.status === "running" ? "暂停任务" : "运行任务"}
										</button>
										<button
											className="secondary danger-action"
											title="删除任务"
											onClick={() => {
												if (
													!window.confirm(
														`删除“${current.name}”？此操作仅影响当前前端数据。`,
													)
												)
													return;
												setDeletedTaskIds((ids) => [...ids, current.id]);
												setPrototypeTasks((items) =>
													items.filter((item) => item.id !== current.id),
												);
												setSelected(undefined);
												setActiveMessageId(undefined);
												setTaskStatusOverrides((statuses) => {
													const nextStatuses = { ...statuses };
													delete nextStatuses[current.id];
													return nextStatuses;
												});
											}}
										>
											<Trash2 size={15} /> 删除
										</button>
									</>
								)}
								<button className="primary" onClick={() => setCreateOpen(true)}>
									<Plus size={16} /> 新建任务
								</button>
							</div>
						</div>
						<div className="metrics">
							<Metric
								label={selectedTask ? "任务状态" : "运行任务"}
								value={
									selectedTask
										? current?.status === "running"
											? "运行中"
											: current?.status === "attention"
												? "需处理"
												: "已暂停"
										: isPreview
											? "4 / 6"
											: `${running} / ${total}`
								}
							/>
							<Metric
								label="今日采集"
								value={
									selectedTask
										? String(selectedMessages.length)
										: isPreview
											? "128"
											: String(state.messages.length)
								}
							/>
							<Metric
								label="已同步"
								value={String(
									selectedTask
										? String(
												selectedMessages.filter(
													(message) => message.status === "synced",
												).length,
											)
										: isPreview
											? 124
											: state.messages.filter((m) => m.status === "synced")
													.length,
								)}
							/>
							<Metric
								label="待处理"
								value={
									selectedTask
										? String(selectedAttention)
										: isPreview
											? "4"
											: String(attention)
								}
							/>
						</div>
						<div className="tabs">
							<button
								className={tab === "messages" ? "tab-active" : ""}
								onClick={() => setTab("messages")}
							>
								消息列表 <b>{isPreview ? "128" : state.messages.length}</b>
							</button>
							<button
								className={tab === "logs" ? "tab-active" : ""}
								onClick={() => setTab("logs")}
							>
								任务日志 <b>{isPreview ? "24" : state.logs.length}</b>
							</button>
							<button
								className={tab === "rules" ? "tab-active" : ""}
								onClick={() => setTab("rules")}
							>
								采集规则
							</button>
							<span className="window-status">
								最近更新 14:32:08
								<button
									className="refresh-action"
									aria-label="刷新"
									onClick={() => void window.copyfast.state().then(setState)}
								>
									<RefreshCw size={12} /> 刷新
								</button>
							</span>
						</div>
						{tab === "messages" ? (
							<MessageList
								state={state}
								task={selectedTask}
								preview={isPreview}
								activeMessageId={activeMessageId}
								onActiveMessageChange={setActiveMessageId}
								onViewMessage={(message) => {
									setSelected(message.taskId);
									setActiveMessageId(message.id);
								}}
							/>
						) : tab === "logs" ? (
							<LogList state={state} />
						) : (
							<Rules task={currentTask} />
						)}
					</section>
				)}
			</div>
			{onboardingOpen && (
				<div className="onboarding-overlay">
					<button
						className="onboarding-highlight"
						aria-label="打开连接与权限"
						onClick={() => {
							completeOnboarding();
							setPage("connections");
						}}
					>
						<Settings2 size={16} /> 连接与权限
					</button>
					<div className="onboarding-callout">
						<span>首次使用 · 连接应用</span>
						<strong>先完成桌面应用设置</strong>
						<p>检查应用安装状态，并按提示完成必要的系统授权。</p>
						<div>
							<button className="onboarding-skip" onClick={completeOnboarding}>
								稍后
							</button>
							<button
								className="primary"
								onClick={() => {
									completeOnboarding();
									setPage("connections");
								}}
							>
								前往连接与权限 <ExternalLink size={13} />
							</button>
						</div>
					</div>
				</div>
			)}
			{createOpen && (
				<TaskDialog
					onClose={() => setCreateOpen(false)}
					onSaved={(input) => {
						addPrototypeTask(input);
						setCreateOpen(false);
					}}
				/>
			)}
		</main>
	);

	function addPrototypeTask(input: TaskInput) {
		const now = new Date().toISOString();
		const task: PublicTask = {
			id: `prototype-${Date.now()}`,
			...input,
			name: input.name,
			status: "paused",
			createdAt: now,
			nextRunAt: now,
			delivery: {
				kind: input.delivery.kind,
				chatId: input.delivery.chatId,
				endpointConfigured: Boolean(input.delivery.endpoint),
				secretConfigured: Boolean(input.delivery.secretId),
			},
		};
		setPrototypeTasks((currentTasks) => [task, ...currentTasks]);
		setSelected(task.id);
		setActiveMessageId(undefined);
		setTab("rules");
	}
}

function normalizeRuntimeInfo(info: RuntimeInfo): RuntimeInfo {
	return {
		...info,
		systemSupported: info.systemSupported ?? ["darwin", "win32"].includes(info.platform),
		apps: info.apps ?? { telegram: false, discord: false },
	};
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="metric">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}
function MessageList({
	state,
	task,
	preview,
	activeMessageId,
	onActiveMessageChange,
	onViewMessage,
}: {
	state: PublicState;
	task:
		| {
				id: string;
				name: string;
				platform: "discord" | "telegram";
				channelCount: number;
		  }
		| undefined;
	preview: boolean;
	activeMessageId: string | undefined;
	onActiveMessageChange: (id: string | undefined) => void;
	onViewMessage: (message: MessageRow) => void;
}) {
	const allRows: MessageRow[] = preview
		? previewMessages
		: state.messages
				.filter((message) => !task || message.taskId === task.id)
				.slice(-8)
				.reverse()
				.map((message) => {
					const sourceTask = state.tasks.find((item) => item.id === message.taskId);
					const sourceChannel = sourceTask?.source.channels.find(
						(channel) => channel.id === message.channelId,
					);
					const targetChannel = sourceTask?.target.channels[0];
					return {
						id: message.key,
						taskId: message.taskId,
						taskName: sourceTask?.name ?? task?.name ?? "采集任务",
						platform: sourceTask?.source.platform ?? task?.platform ?? "discord",
						source: `${sourceTask?.source.server.name ?? "来源服务器"} / #${sourceChannel?.name ?? message.channelId}`,
						author: message.author || "未知作者",
						time: new Date(message.sentAt).toLocaleTimeString(),
						text:
							message.text ||
							(message.attachments.length ? "附件消息" : "无文本内容"),
						target: `${sourceTask?.target.server.name ?? "我的服务器"} / #${targetChannel?.name ?? "目标频道"}`,
						status: message.status,
					};
				});
	const rows = task ? allRows.filter((message) => message.taskId === task.id) : allRows;
	const activeMessage = rows.find((message) => message.id === activeMessageId) ?? rows[0];
	const statusText: Record<string, string> = {
		synced: "已同步",
		pending: "待同步",
		sending: "同步中",
		failed: "同步失败",
		uncertain: "需核对",
		filtered: "已过滤",
	};
	return (
		<Panel>
			<div className="filters">
				<button>
					{task ? (task.platform === "telegram" ? "Telegram" : "Discord") : "全部平台"}{" "}
					<ChevronDown size={13} />
				</button>
				<button>
					{task?.name ?? "全部任务"} <ChevronDown size={13} />
				</button>
				<button>
					全部状态 <ChevronDown size={13} />
				</button>
				<button>
					今天 <ChevronDown size={13} />
				</button>
				<span>
					<Filter size={14} />
					搜索消息、作者或频道
				</span>
			</div>
			{!task && (
				<div className="table-head">
					<span>消息 / 来源</span>
					<span>消息内容</span>
					<span>同步状态</span>
					<span>详情</span>
				</div>
			)}
			{rows.length ? (
				task ? (
					<div className="task-message-layout">
						<section className="task-message-list">
							<header>
								<strong>
									{task.name} · {task.channelCount} 个频道
								</strong>
								<small>{preview ? "128" : rows.length} 条采集记录 / 当前任务</small>
							</header>
							<div className="task-message-items">
								{rows.map((message) => (
									<button
										className={
											activeMessage?.id === message.id
												? "message-selected"
												: ""
										}
										key={message.id}
										onClick={() => onActiveMessageChange(message.id)}
									>
										<strong>
											{message.author} ·{" "}
											{message.source.split("/").at(-1)?.trim()}
										</strong>
										<span>{message.text}</span>
										<small>
											{message.time} ·{" "}
											{statusText[message.status] ?? message.status}
										</small>
									</button>
								))}
							</div>
						</section>
						<aside className="message-detail">
							<div className="message-detail-heading">
								<strong>消息详情</strong>
								<span className={`state ${activeMessage?.status ?? ""}`}>
									{activeMessage
										? (statusText[activeMessage.status] ?? activeMessage.status)
										: ""}
								</span>
							</div>
							{activeMessage ? (
								<>
									<small>来源　{activeMessage.source}</small>
									<b>
										{activeMessage.author}　·　{activeMessage.time}
									</b>
									<p>{activeMessage.text}</p>
									<div className="detail-target">
										<small>同步到</small>
										<b>{activeMessage.target}</b>
									</div>
									<small>消息 ID　{activeMessage.id}</small>
								</>
							) : (
								<p>选择一条消息查看详情。</p>
							)}
						</aside>
					</div>
				) : (
					<>
						{rows.map((message) => (
							<div className="data-row" key={message.id}>
								<div className="row-source">
									<i className={`platform ${message.platform}`}>
										{message.platform === "telegram" ? "TG" : "DC"}
									</i>
									<div>
										<b>{message.taskName}</b>
										<small>
											{message.source} · {message.author} · {message.time}
										</small>
									</div>
								</div>
								<div className="message-copy">
									<span>{message.text}</span>
								</div>
								<strong className={`state ${message.status}`}>
									<span>{statusText[message.status] ?? message.status}</span>
									<small>{message.target}</small>
								</strong>
								<button
									className="row-action"
									onClick={() => onViewMessage(message)}
								>
									查看
								</button>
							</div>
						))}
						<div className="pagination">
							<span>显示 1–5 条，共 {preview ? 128 : rows.length} 条消息</span>
							<span>‹　1　2　3　…　{preview ? 26 : 1}　›</span>
						</div>
						{preview && (
							<div className="preview-note">
								示例数据 · 任务状态、采集记录与消息同步结果在此统一查看
							</div>
						)}
					</>
				)
			) : (
				<Empty
					title="等待采集消息"
					detail="启动任务后，采集内容会按来源、规则和同步结果出现在这里。"
				/>
			)}
		</Panel>
	);
}
function LogList({ state }: { state: PublicState }) {
	return (
		<Panel>
			<div className="filters">
				<button>
					全部平台 <ChevronDown size={14} />
				</button>
				<button>
					全部任务 <ChevronDown size={14} />
				</button>
				<button>
					全部状态 <ChevronDown size={14} />
				</button>
				<span>
					<RefreshCw size={14} />
					自动刷新
				</span>
			</div>
			{state.logs.length ? (
				state.logs
					.slice(-10)
					.reverse()
					.map((log) => (
						<div className="log-row" key={log.id}>
							<div>
								<b>{new Date(log.startedAt).toLocaleTimeString()}</b>
								<small>
									{log.id.slice(0, 8)} · {log.phase}
								</small>
							</div>
							<b>{log.status}</b>
							<span>
								{log.collected} / {log.saved} / {log.failed}
							</span>
							<span>
								{log.durationMs
									? `${(log.durationMs / 1000).toFixed(1)} s`
									: "处理中"}
							</span>
							<button>详情</button>
						</div>
					))
			) : (
				<Empty
					title="暂无执行日志"
					detail="每次采集、同步和规则保存都会在这里留下可追踪记录。"
				/>
			)}
		</Panel>
	);
}
function Rules({ task }: { task: PublicTask | undefined }) {
	return (
		<Panel>
			<div className="rule-grid">
				<section>
					<h3>01 采集来源</h3>
					<b>{task?.source.server.name ?? "未选择来源"}</b>
					<span>{task?.source.channels.length ?? 0} 个频道</span>
					{task?.source.channels.map((channel) => (
						<label key={channel.id}># {channel.name}</label>
					))}
				</section>
				<section>
					<h3>02 同步到自己的频道</h3>
					<b>{task?.target.server.name ?? "未设置目标"}</b>
					<span>{task?.target.channels.length ?? 0} 个目标频道</span>
					{task?.target.channels.map((channel) => (
						<label key={channel.id}>→ {channel.name}</label>
					))}
				</section>
				<section className="rules-full">
					<h3>03 采集与同步规则</h3>
					<div className="rule-fields">
						<label>
							采集频率 <b>{task ? `${task.rules.intervalSeconds} 秒` : "每 30 秒"}</b>
						</label>
						<div>
							消息去重 <b>已开启</b>
						</div>
						<label>
							失败处理 <b>最多重试 {task?.rules.maxRetries ?? 3} 次</b>
						</label>
						<div>
							消息类型 <b>文字 · 图片 · 附件</b>
						</div>
					</div>
				</section>
			</div>
		</Panel>
	);
}
function Panel({ children }: { children: React.ReactNode }) {
	return <div className="panel">{children}</div>;
}
function Empty({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="empty">
			<CircleAlert size={22} />
			<b>{title}</b>
			<span>{detail}</span>
		</div>
	);
}
