import {
	Activity,
	ChevronDown,
	CircleAlert,
	ExternalLink,
	Filter,
	List,
	MessageSquareText,
	Plus,
	RefreshCw,
	Settings2,
	SlidersHorizontal,
	X,
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

export function App({ island }: { island: boolean }) {
	const [state, setState] = useState<PublicState>(emptyState);
	const [tab, setTab] = useState("messages");
	const [selected, setSelected] = useState<string>();
	const [expanded, setExpanded] = useState(false);
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
	if (island)
		return (
			<Island
				state={state}
				expanded={expanded}
				setExpanded={setExpanded}
				onSelect={(task) => {
					setSelected(task);
					void window.copyfast.showWorkspace(task, "messages");
				}}
			/>
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
	return (
		<main className="app-shell">
			<header className="titlebar">
				<span className="traffic">● ● ●</span>
				<strong>CopyFast</strong>
				<span className="window-status">
					{running} 运行 · {attention} 需处理
				</span>
				<button onClick={() => window.copyfast.windowAction("minimize")}>
					<X size={15} />
				</button>
			</header>
			<div className="workspace">
				<aside className="sidebar">
					<div className="brand">
						CF <span>CopyFast</span>
					</div>
					<div className="eyebrow">工作台</div>
					<div className="nav-active">
						<List size={16} />
						采集工作台
					</div>
					<div className="nav-muted">
						<Settings2 size={16} />
						本机设置
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
						<div className="eyebrow">平台连接（界面示例）</div>
						<div className="connection">
							<b>TG</b>Telegram <small>未连接</small>
						</div>
						<div className="connection">
							<b>DC</b>Discord <small>未连接</small>
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
							<div className="eyebrow">工作区 / 本机任务</div>
							<h1>采集工作台</h1>
							<p>
								{current
									? `${current.name} · ${current.source} → ${current.target}`
									: "统一查看多平台任务、采集日志与消息记录。"}
							</p>
						</div>
						<button className="primary" onClick={() => setCreateOpen(true)}>
							<Plus size={16} />
							新建任务
						</button>
					</div>
					<div className="metrics">
						<Metric label="运行任务" value={`${running} / ${total}`} />
						<Metric label="今日采集" value={String(state.messages.length)} />
						<Metric
							label="已同步"
							value={String(
								state.messages.filter((m) => m.status === "synced").length,
							)}
						/>
						<Metric label="待处理" value={String(attention)} />
					</div>
					<div className="tabs">
						<button
							className={tab === "messages" ? "tab-active" : ""}
							onClick={() => setTab("messages")}
						>
							<MessageSquareText size={15} />
							消息列表 <b>{state.messages.length}</b>
						</button>
						<button
							className={tab === "logs" ? "tab-active" : ""}
							onClick={() => setTab("logs")}
						>
							<Activity size={15} />
							任务日志 <b>{state.logs.length}</b>
						</button>
						<button
							className={tab === "rules" ? "tab-active" : ""}
							onClick={() => setTab("rules")}
						>
							<SlidersHorizontal size={15} />
							采集范围与规则
						</button>
					</div>
					{tab === "messages" ? (
						<MessageList state={state} />
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
function MessageList({ state }: { state: PublicState }) {
	const rows = state.messages.length ? state.messages : [];
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
					<Filter size={14} />
					搜索消息、作者或频道
				</span>
			</div>
			{rows.length ? (
				rows
					.slice(-8)
					.reverse()
					.map((m) => (
						<div className="data-row" key={m.key}>
							<i className="platform">消息</i>
							<div>
								<b>{m.author || "未知作者"}</b>
								<small>
									{m.channelId} · {new Date(m.sentAt).toLocaleTimeString()}
								</small>
							</div>
							<p>{m.text || "附件消息"}</p>
							<strong className={`state ${m.status}`}>
								{m.status === "synced"
									? "已同步"
									: m.status === "uncertain"
										? "需核对"
										: m.status === "failed"
											? "同步失败"
											: "待同步"}
							</strong>
						</div>
					))
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
function Island({
	state,
	expanded,
	setExpanded,
	onSelect,
}: {
	state: PublicState;
	expanded: boolean;
	setExpanded: (value: boolean) => void;
	onSelect: (task: string) => void;
}) {
	const tasks = state.tasks.length ? state.tasks.map(toDisplayTask) : sampleTasks;
	const running = tasks.filter((t) => t.status === "running").length;
	const paused = tasks.filter((t) => t.status === "paused").length;
	const attention = tasks.filter((t) => t.status === "attention").length;
	const telegram = tasks.filter((t) => t.platform === "telegram").length;
	const discord = tasks.filter((t) => t.platform === "discord").length;
	return (
		<div className={`island ${expanded ? "island-expanded" : ""}`}>
			<div className="island-head">
				<b>CF</b>
				<span>
					<strong>{running} 运行</strong>
					<small>
						TG {telegram} · DC {discord}
					</small>
				</span>
				<span className="island-status">
					Ⅱ {paused}　! {attention}
				</span>
				<button
					onClick={(event) => {
						event.stopPropagation();
						setExpanded(!expanded);
					}}
				>
					{expanded ? "收起" : "⌄"}
				</button>
			</div>
			{expanded && (
				<div className="island-tasks">
					{tasks.map((task) => (
						<button key={task.id} onClick={() => onSelect(task.id)}>
							<i className={`platform ${task.platform}`}>
								{task.platform === "telegram" ? "TG" : "DC"}
							</i>
							<span>
								<b>{task.name}</b>
								<small>
									{task.source} → {task.target}
								</small>
							</span>
							<strong className={`state ${task.status}`}>
								{task.status === "attention"
									? "! 需处理"
									: task.status === "paused"
										? "Ⅱ 已暂停"
										: "⟳ 运行中"}
							</strong>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
