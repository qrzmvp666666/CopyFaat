import {
	CircleAlert,
	Crown,
	ExternalLink,
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

import type {
	Message,
	PublicState,
	PublicTask,
	RuntimeInfo,
	TaskInput,
} from "../../shared/contracts";
import { Connections } from "./Connections";
import { TaskDialog } from "./TaskDialog";

const emptyState: PublicState = { version: 1, tasks: [], messages: [], logs: [] };
type MessageRow = {
	id: string;
	taskId: string;
	taskName: string;
	platform: "discord" | "telegram";
	source: string;
	author: string;
	time: string;
	text: string;
	status: string;
	message: Message;
};

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
	const [refreshAt, setRefreshAt] = useState(() => new Date());
	const [accountPanel, setAccountPanel] = useState<"profile" | "membership" | null>(null);
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
	const tasks = state.tasks;
	const total = tasks.length;
	const running = tasks.filter((t) => t.status === "running").length;
	const attention = tasks.filter((t) => t.status === "attention").length;
	const current = tasks.find((t) => t.id === selected) ?? tasks[0];
	const selectedTask = selected ? current : undefined;
	const currentTask = selectedTask;
	const selectedMessages = selectedTask
		? state.messages.filter((message) => message.taskId === selectedTask.id)
		: state.messages;
	const today = new Date().toDateString();
	const todayMessages = selectedMessages.filter(
		(message) => new Date(message.collectedAt).toDateString() === today,
	);
	const selectedAttention = selectedMessages.filter(
		(message) => message.status === "failed",
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
								<i className={`platform ${task.source.platform}`}>
									{task.source.platform === "telegram" ? "TG" : "DC"}
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
										? `任务 / ${selectedTask.source.platform === "telegram" ? "Telegram" : "Discord"}`
										: "工作区 / 本机采集"}
								</div>
								<h1>{selectedTask?.name ?? "采集工作台"}</h1>
								<p>
									{selectedTask
										? `${current?.source.server.name ?? "来源未配置"} · ${current?.source.channels.length ?? 0} 个频道`
										: "统一查看本机采集结果与执行记录。"}
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
												void window.copyfast
													.taskAction(
														current.id,
														current.status === "running"
															? "pause"
															: "resume",
													)
													.catch((error: unknown) =>
														window.alert(
															error instanceof Error
																? error.message
																: "任务操作失败",
														),
													)
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
														`删除“${current.name}”？已采集的消息和历史日志会保留。`,
													)
												)
													return;
												void window.copyfast
													.deleteTask(current.id)
													.then(() => {
														setSelected(undefined);
														setActiveMessageId(undefined);
													})
													.catch((error: unknown) =>
														window.alert(
															error instanceof Error
																? error.message
																: "删除任务失败",
														),
													);
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
										: `${running} / ${total}`
								}
							/>
							<Metric
								label="今日采集"
								value={
									selectedTask
										? String(todayMessages.length)
										: String(
												state.messages.filter(
													(message) =>
														new Date(
															message.collectedAt,
														).toDateString() === today,
												).length,
											)
								}
							/>
							<Metric
								label="累计采集"
								value={String(
									selectedTask
										? String(
												selectedMessages.filter(
													(message) => message.status === "collected",
												).length,
											)
										: String(
												state.messages.filter(
													(message) => message.status === "collected",
												).length,
											),
								)}
							/>
							<Metric
								label="待处理"
								value={
									selectedTask
										? String(
												current?.status === "attention"
													? Math.max(selectedAttention, 1)
													: selectedAttention,
											)
										: String(attention)
								}
							/>
						</div>
						<div className="tabs">
							<button
								className={tab === "messages" ? "tab-active" : ""}
								onClick={() => setTab("messages")}
							>
								消息列表{" "}
								<b>
									{selectedTask ? selectedMessages.length : state.messages.length}
								</b>
							</button>
							<button
								className={tab === "logs" ? "tab-active" : ""}
								onClick={() => setTab("logs")}
							>
								任务日志{" "}
								<b>
									{
										state.logs.filter(
											(log) =>
												!selectedTask || log.taskId === selectedTask.id,
										).length
									}
								</b>
							</button>
							<button
								className={tab === "rules" ? "tab-active" : ""}
								onClick={() => setTab("rules")}
							>
								采集规则
							</button>
							<span className="window-status">
								最近更新 {refreshAt.toLocaleTimeString()}
								<button
									className="refresh-action"
									aria-label="刷新"
									onClick={() =>
										void window.copyfast.state().then((nextState) => {
											setState(nextState);
											setRefreshAt(new Date());
										})
									}
								>
									<RefreshCw size={12} /> 刷新
								</button>
							</span>
						</div>
						{tab === "messages" ? (
							<MessageList
								state={state}
								task={selectedTask}
								allTasks={state.tasks}
								activeMessageId={activeMessageId}
								onActiveMessageChange={setActiveMessageId}
								onViewMessage={(message) => {
									setSelected(message.taskId);
									setActiveMessageId(message.id);
								}}
							/>
						) : tab === "logs" ? (
							<LogList
								state={state}
								taskId={selectedTask?.id}
								onShowMessages={(messageKey) => {
									setTab("messages");
									setActiveMessageId(messageKey);
								}}
							/>
						) : (
							<Rules
								task={currentTask}
								onSaved={async (input) => {
									if (!currentTask) return;
									await window.copyfast.saveTask(input, currentTask.id);
									setState(await window.copyfast.state());
								}}
							/>
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
					onSaved={async (input) => {
						const id = await window.copyfast.saveTask(input);
						setState(await window.copyfast.state());
						setSelected(id);
						setActiveMessageId(undefined);
						setTab("rules");
						setCreateOpen(false);
					}}
				/>
			)}
		</main>
	);
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
	allTasks,
	activeMessageId,
	onActiveMessageChange,
	onViewMessage,
}: {
	state: PublicState;
	task: PublicTask | undefined;
	allTasks: PublicTask[];
	activeMessageId: string | undefined;
	onActiveMessageChange: (id: string | undefined) => void;
	onViewMessage: (message: MessageRow) => void;
}) {
	const [platformFilter, setPlatformFilter] = useState("all");
	const [taskFilter, setTaskFilter] = useState(task?.id ?? "all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("today");
	const [query, setQuery] = useState("");
	const allRows: MessageRow[] = state.messages
		.map((message) => {
			const sourceTask = allTasks.find((item) => item.id === message.taskId);
			const sourceChannel = sourceTask?.source.channels.find(
				(channel) => channel.id === message.channelId,
			);
			return {
				id: message.key,
				message,
				taskId: message.taskId,
				taskName: message.taskName ?? sourceTask?.name ?? "已删除的任务",
				platform: message.platform ?? sourceTask?.source.platform ?? "discord",
				source: `${message.sourceName ?? sourceTask?.source.server.name ?? "来源未知"} / #${message.channelName ?? sourceChannel?.name ?? message.channelId}`,
				author: message.author || "未知作者",
				time: new Date(message.sentAt).toLocaleString(),
				text: message.text || (message.attachments.length ? "附件消息" : "无文本内容"),
				status: message.status,
			};
		})
		.reverse();
	const dayStart = new Date();
	dayStart.setHours(0, 0, 0, 0);
	const rows = allRows.filter((row) => {
		if (task && row.taskId !== task.id) return false;
		if (!task && taskFilter !== "all" && row.taskId !== taskFilter) return false;
		if (platformFilter !== "all" && row.platform !== platformFilter) return false;
		if (statusFilter !== "all" && row.status !== statusFilter) return false;
		if (dateFilter === "today" && Date.parse(row.message.collectedAt) < dayStart.getTime())
			return false;
		const needle = query.trim().toLocaleLowerCase();
		return (
			!needle ||
			`${row.taskName} ${row.source} ${row.author} ${row.text}`
				.toLocaleLowerCase()
				.includes(needle)
		);
	});
	const activeMessage = rows.find((message) => message.id === activeMessageId) ?? rows[0];
	const statusText: Record<string, string> = {
		collected: "已采集",
		pending: "待处理",
		sending: "处理中",
		synced: "已采集",
		failed: "采集失败",
		uncertain: "需检查",
		filtered: "已过滤",
	};
	return (
		<Panel>
			<div className="filters">
				<select
					aria-label="平台筛选"
					value={platformFilter}
					onChange={(event) => setPlatformFilter(event.target.value)}
				>
					<option value="all">全部平台</option>
					<option value="telegram">Telegram</option>
					<option value="discord">Discord</option>
				</select>
				<select
					aria-label="任务筛选"
					value={task ? task.id : taskFilter}
					disabled={Boolean(task)}
					onChange={(event) => setTaskFilter(event.target.value)}
				>
					<option value="all">全部任务</option>
					{allTasks.map((item) => (
						<option key={item.id} value={item.id}>
							{item.name}
						</option>
					))}
				</select>
				<select
					aria-label="状态筛选"
					value={statusFilter}
					onChange={(event) => setStatusFilter(event.target.value)}
				>
					<option value="all">全部状态</option>
					<option value="collected">已采集</option>
					<option value="filtered">已过滤</option>
					<option value="failed">采集失败</option>
				</select>
				<select
					aria-label="日期筛选"
					value={dateFilter}
					onChange={(event) => setDateFilter(event.target.value)}
				>
					<option value="today">今天</option>
					<option value="all">全部日期</option>
				</select>
				<input
					aria-label="搜索消息"
					type="search"
					placeholder="搜索消息、作者或频道"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>
			{!task && (
				<div className="table-head">
					<span>消息 / 来源</span>
					<span>消息内容</span>
					<span>采集状态</span>
					<span>详情</span>
				</div>
			)}
			{rows.length ? (
				task ? (
					<div className="task-message-layout">
						<section className="task-message-list">
							<header>
								<strong>
									{task.name} · {task.source.channels.length} 个频道
								</strong>
								<small>{rows.length} 条采集记录 / 当前任务</small>
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
										<small>本机采集时间</small>
										<b>
											{new Date(
												activeMessage.message.collectedAt,
											).toLocaleString()}
										</b>
									</div>
									{activeMessage.message.attachments.length > 0 && (
										<div className="detail-target">
											<small>附件</small>
											<b>
												{activeMessage.message.attachments
													.map((attachment) => attachment.name)
													.join("、")}
											</b>
										</div>
									)}
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
									<small>
										{new Date(message.message.collectedAt).toLocaleTimeString()}
									</small>
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
							<span>共 {rows.length} 条消息</span>
						</div>
					</>
				)
			) : (
				<Empty
					title={state.messages.length ? "没有符合条件的消息" : "等待采集消息"}
					detail={
						state.messages.length
							? "调整筛选条件，查看其他本地采集记录。"
							: "运行一个任务后，采集结果会保存在这里。"
					}
				/>
			)}
		</Panel>
	);
}
function LogList({
	state,
	taskId,
	onShowMessages,
}: {
	state: PublicState;
	taskId?: string;
	onShowMessages: (messageId?: string) => void;
}) {
	const [statusFilter, setStatusFilter] = useState("all");
	const [phaseFilter, setPhaseFilter] = useState("all");
	const logs = state.logs.filter(
		(log) =>
			(!taskId || log.taskId === taskId) &&
			(statusFilter === "all" || log.status === statusFilter) &&
			(phaseFilter === "all" || log.phase === phaseFilter),
	);
	return (
		<Panel>
			<div className="filters">
				<select
					aria-label="日志类型筛选"
					value={phaseFilter}
					onChange={(event) => setPhaseFilter(event.target.value)}
				>
					<option value="all">全部记录</option>
					<option value="collect">采集</option>
					<option value="settings">规则保存</option>
				</select>
				<select
					aria-label="日志状态筛选"
					value={statusFilter}
					onChange={(event) => setStatusFilter(event.target.value)}
				>
					<option value="all">全部状态</option>
					<option value="success">成功</option>
					<option value="partial">部分完成</option>
					<option value="failed">失败</option>
					<option value="processing">进行中</option>
				</select>
			</div>
			{logs.length ? (
				logs.reverse().map((log) => (
					<div className="log-row" key={log.id}>
						<div>
							<b>{new Date(log.startedAt).toLocaleTimeString()}</b>
							<small>
								{state.tasks.find((task) => task.id === log.taskId)?.name ??
									"已删除的任务"}{" "}
								·{" "}
								{log.phase === "collect"
									? "采集"
									: log.phase === "settings"
										? "规则保存"
										: "历史记录"}
							</small>
						</div>
						<b>
							{log.status === "success"
								? "成功"
								: log.status === "processing"
									? "进行中"
									: log.status === "partial"
										? "部分完成"
										: "失败"}
						</b>
						<span>
							采集 {log.collected} · 保存 {log.saved} · 忽略 {log.ignored} · 失败{" "}
							{log.failed}
						</span>
						<span>
							{log.durationMs ? `${(log.durationMs / 1000).toFixed(1)} s` : "处理中"}
						</span>
						<button onClick={() => onShowMessages(log.messageKeys[0])}>
							查看关联消息
						</button>
					</div>
				))
			) : (
				<Empty
					title="暂无执行日志"
					detail="每次任务运行和规则变更都会在这里留下本地记录。"
				/>
			)}
		</Panel>
	);
}
function Rules({
	task,
	onSaved,
}: {
	task: PublicTask | undefined;
	onSaved: (input: TaskInput) => Promise<void>;
}) {
	const [interval, setInterval] = useState(task?.rules.intervalSeconds ?? 60);
	const [include, setInclude] = useState(task?.rules.include ?? "");
	const [exclude, setExclude] = useState(task?.rules.exclude ?? "");
	const [text, setText] = useState(task?.rules.text ?? true);
	const [images, setImages] = useState(task?.rules.images ?? true);
	const [attachments, setAttachments] = useState(task?.rules.attachments ?? true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	useEffect(() => {
		setInterval(task?.rules.intervalSeconds ?? 60);
		setInclude(task?.rules.include ?? "");
		setExclude(task?.rules.exclude ?? "");
		setText(task?.rules.text ?? true);
		setImages(task?.rules.images ?? true);
		setAttachments(task?.rules.attachments ?? true);
	}, [task]);
	async function saveRules(event: React.FormEvent) {
		event.preventDefault();
		if (!task) return;
		setSaving(true);
		setMessage("");
		try {
			await onSaved({
				name: task.name,
				source: task.source,
				collector: task.collector,
				rules: {
					...task.rules,
					intervalSeconds: interval,
					include,
					exclude,
					text,
					images,
					attachments,
				},
			});
			setMessage("规则已保存");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "保存失败，请重试");
		} finally {
			setSaving(false);
		}
	}
	return (
		<Panel>
			{!task ? (
				<Empty
					title="选择一个任务查看采集规则"
					detail="从左侧选择任务，或新建任务开始配置。"
				/>
			) : (
				<form onSubmit={saveRules}>
					<div className="rule-grid">
						<section>
							<h3>01 采集来源</h3>
							<b>{task?.source.server.name ?? "未选择来源"}</b>
							<span>{task?.source.channels.length ?? 0} 个频道</span>
							{task?.source.channels.map((channel) => (
								<label key={channel.id}># {channel.name}</label>
							))}
						</section>
						<section className="rules-full">
							<h3>02 采集规则</h3>
							<div className="rule-fields">
								<label className="field">
									采集间隔（秒）
									<input
										type="number"
										min={10}
										max={86400}
										value={interval}
										onChange={(event) =>
											setInterval(Number(event.target.value))
										}
									/>
								</label>
								<label className="field">
									仅包含关键词
									<input
										value={include}
										onChange={(event) => setInclude(event.target.value)}
										placeholder="逗号分隔，可留空"
									/>
								</label>
								<label className="field">
									排除关键词
									<input
										value={exclude}
										onChange={(event) => setExclude(event.target.value)}
										placeholder="逗号分隔，可留空"
									/>
								</label>
								<label>
									<input
										type="checkbox"
										checked={text}
										onChange={(event) => setText(event.target.checked)}
									/>
									文字
								</label>
								<label>
									<input
										type="checkbox"
										checked={images}
										onChange={(event) => setImages(event.target.checked)}
									/>
									图片
								</label>
								<label>
									<input
										type="checkbox"
										checked={attachments}
										onChange={(event) => setAttachments(event.target.checked)}
									/>
									文件
								</label>
							</div>
						</section>
					</div>
					<div className="rule-actions">
						<span role="status">{message}</span>
						<button className="primary" disabled={saving}>
							{saving ? "保存中…" : "保存规则"}
						</button>
					</div>
				</form>
			)}
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
