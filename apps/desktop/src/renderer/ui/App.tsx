import {
	ChevronDown,
	CircleAlert,
	ExternalLink,
	Filter,
	List,
	Plus,
	RefreshCw,
	Settings2,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { PublicState, PublicTask } from "../../shared/contracts";
import type { TaskInput } from "../../shared/contracts";
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
	{ id: "preview-1", taskName: "行业快讯", platform: "telegram", source: "行业观察 / #行业快讯", author: "Atlas", time: "14:32:08", text: "本周产品更新已发布，完整更新说明见频道置顶。", target: "my-tg / #行业快讯", status: "synced" },
	{ id: "preview-2", taskName: "产品更新汇总", platform: "discord", source: "产品社区 / #产品更新", author: "Mia", time: "14:31:45", text: "桌面端新增多频道选择，现已开放测试。", target: "my-dc / #产品资讯", status: "synced" },
	{ id: "preview-3", taskName: "海外资讯", platform: "telegram", source: "海外资讯 / #news", author: "Nova", time: "14:31:22", text: "开发者活动将于周五开始，报名入口已更新。", target: "my-dc / #海外资讯", status: "pending" },
	{ id: "preview-4", taskName: "团队公告", platform: "discord", source: "团队空间 / #公告", author: "Alex", time: "14:30:52", text: "团队周会记录已整理，请在本周内确认。", target: "my-tg / #团队公告", status: "failed" },
	{ id: "preview-5", taskName: "社区公告同步", platform: "discord", source: "开发者社区 / #公告", author: "Ryan", time: "14:30:12", text: "社区文档更新完成，请使用最新链接。", target: "my-dc / #社区公告", status: "synced" },
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
	const [tab, setTab] = useState("messages");
	const [selected, setSelected] = useState<string>();
	const [createOpen, setCreateOpen] = useState(false);
	const [prototypeTasks, setPrototypeTasks] = useState<PublicTask[]>([]);
	useEffect(() => {
		void window.copyfast.state().then(setState);
		return window.copyfast.onState(setState);
	}, []);
	useEffect(
		() =>
			window.copyfast.onNavigate((target) => {
				if (target.tab) setTab(target.tab);
				if (target.taskId) setSelected(target.taskId);
			}),
		[],
	);
	const tasks = state.tasks.length
		? state.tasks.map(toDisplayTask)
		: [...prototypeTasks.map(toDisplayTask), ...sampleTasks];
	const total = tasks.length;
	const running = tasks.filter((t) => t.status === "running").length;
	const attention = tasks.filter((t) => t.status === "attention").length;
	const current = tasks.find((t) => t.id === selected) ?? tasks[0];
	const currentTask =
		state.tasks.find((t) => t.id === current?.id) ??
		prototypeTasks.find((t) => t.id === current?.id) ??
		state.tasks[0];
	const isPreview =
		state.tasks.length === 0 &&
		state.messages.length === 0 &&
		state.logs.length === 0 &&
		prototypeTasks.length === 0;
	return (
		<main className="app-shell">
			<header className="titlebar">
				<span className="traffic" aria-hidden="true" />
				<strong>CopyFast</strong>
			</header>
			<div className="workspace">
				<aside className="sidebar">
					<div className="brand">
						<span className="brand-mark">CF</span> CopyFast
					</div>
					<div className="eyebrow">工作台</div>
					<div className="nav-active">
						<List size={16} />
						采集工作台
					</div>
					<div className="nav-muted">
						<Settings2 size={16} />
						连接与权限
					</div>
					<div className="task-label">
						全部任务 <span>{total}</span>
						<button aria-label="新建采集任务" onClick={() => setCreateOpen(true)}>
							<Plus size={16} />
						</button>
					</div>
					<div className="task-list">
						{tasks.map((task) => (
							<button
								className={current?.id === task.id ? "task-selected" : ""}
								key={task.id}
								onClick={() => setSelected(task.id)}
							>
								<i className={`platform ${task.platform}`}>
									{task.platform === "telegram" ? "TG" : "DC"}
								</i>
								{task.name}
							</button>
						))}
					</div>
					<div className="sidebar-bottom">
						<div className="eyebrow">已连接平台</div>
						<div className="connection">
							<b>TG</b>Telegram <small>{isPreview ? "已连接" : "未连接"}</small>
						</div>
						<div className="connection">
							<b>DC</b>Discord <small>{isPreview ? "已连接" : "未连接"}</small>
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
				<section className="content">
					<div className="content-head">
						<div>
							<div className="eyebrow">工作区 / 采集与同步</div>
							<h1>采集工作台</h1>
							<p>
								统一查看多平台采集结果，追踪每一次采集与同步。
							</p>
						</div>
						<button className="primary" onClick={() => setCreateOpen(true)}>
							<Plus size={16} />
							新建任务
						</button>
					</div>
					<div className="metrics">
						<Metric label="运行任务" value={isPreview ? "4 / 6" : `${running} / ${total}`} />
						<Metric label="今日采集" value={isPreview ? "128" : String(state.messages.length)} />
						<Metric
							label="已同步"
							value={String(
								isPreview
									? 124
									: state.messages.filter((m) => m.status === "synced").length,
							)}
						/>
						<Metric label="待处理" value={isPreview ? "4" : String(attention)} />
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
							采集范围与规则
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
						<MessageList state={state} task={currentTask} preview={isPreview} />
					) : tab === "logs" ? (
						<LogList state={state} />
					) : (
						<Rules task={currentTask} />
					)}
				</section>
			</div>
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
		setTab("rules");
	}
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
}: {
	state: PublicState;
	task: PublicTask | undefined;
	preview: boolean;
}) {
	const rows: MessageRow[] = preview
		? previewMessages
		: state.messages.slice(-8).reverse().map((message) => {
				const sourceTask = state.tasks.find((item) => item.id === message.taskId);
				const sourceChannel = sourceTask?.source.channels.find(
					(channel) => channel.id === message.channelId,
				);
				const targetChannel = sourceTask?.target.channels[0];
				return {
					id: message.key,
					taskName: sourceTask?.name ?? task?.name ?? "采集任务",
					platform: sourceTask?.source.platform ?? task?.source.platform ?? "discord",
					source: `${sourceTask?.source.server.name ?? "来源服务器"} / #${sourceChannel?.name ?? message.channelId}`,
					author: message.author || "未知作者",
					time: new Date(message.sentAt).toLocaleTimeString(),
					text: message.text || (message.attachments.length ? "附件消息" : "无文本内容"),
					target: `${sourceTask?.target.server.name ?? "我的服务器"} / #${targetChannel?.name ?? "目标频道"}`,
					status: message.status,
				};
			});
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
					全部平台 <ChevronDown size={13} />
				</button>
				<button>
					全部任务 <ChevronDown size={13} />
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
			<div className="table-head">
				<span>消息 / 来源</span>
				<span>消息内容</span>
				<span>同步状态</span>
				<span>详情</span>
			</div>
			{rows.length ? (
				<>
					{rows.map((message) => (
							<div className="data-row" key={message.id}>
								<div className="row-source">
									<i className={`platform ${message.platform}`}>
										{message.platform === "telegram" ? "TG" : "DC"}
									</i>
									<div>
										<b>{message.taskName}</b>
										<small>{message.source} · {message.author} · {message.time}</small>
									</div>
								</div>
								<div className="message-copy">
									<span>{message.text}</span>
								</div>
								<strong className={`state ${message.status}`}>
									<span>{statusText[message.status] ?? message.status}</span>
									<small>{message.target}</small>
								</strong>
								<button className="row-action">查看</button>
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
