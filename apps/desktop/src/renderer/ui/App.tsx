import {
	CircleAlert,
	Crown,
	ExternalLink,
	List,
	PanelLeft,
	Pause,
	Play,
	Plus,
	Settings2,
	Trash2,
	UserRound,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

import discordIcon from "../../../assets/discord-monochrome.svg";
import appIcon from "../../../assets/icon.png";
import telegramIcon from "../../../assets/telegram-monochrome.svg";
import type { PublicState, PublicTask, RuntimeInfo, TaskInput } from "../../shared/contracts";
import { ChannelWorkspace } from "./ChannelWorkspace";
import { Connections } from "./Connections";
import { TaskDialog } from "./TaskDialog";

const emptyState: PublicState = { version: 1, tasks: [], messages: [], logs: [] };
export function App() {
	const [liveState, setState] = useState<PublicState>(emptyState);
	const state = liveState;
	const [sidebarCollapsed, setSidebarCollapsed] = useState(
		() => localStorage.getItem("copyfast-sidebar-collapsed") === "true",
	);
	const [isPanelExpanded, setIsPanelExpanded] = useState(false);
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
	const [createOpen, setCreateOpen] = useState(false);
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
	const isWorkspaceExpanded = isPanelExpanded && page === "workspace" && tab !== "rules";
	const isSidebarCollapsed = sidebarCollapsed || isWorkspaceExpanded;
	const tasks = state.tasks;
	const total = tasks.length;
	const running = tasks.filter((t) => t.status === "running").length;
	const attention = tasks.filter((t) => t.status === "attention").length;
	const current = tasks.find((t) => t.id === selected);
	const selectedTask = current;
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
				<aside className={`sidebar${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
					<div className="brand">
						<img className="brand-mark" src={appIcon} alt="" aria-hidden="true" />
						<span className="sidebar-label brand-text">CopyFast</span>
						<button
							type="button"
							className="sidebar-toggle"
							aria-label={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
							title={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
							aria-expanded={!isSidebarCollapsed}
							onClick={() => {
								setIsPanelExpanded(false);
								setSidebarCollapsed(!isSidebarCollapsed);
								localStorage.setItem(
									"copyfast-sidebar-collapsed",
									String(!isSidebarCollapsed),
								);
							}}
						>
							<PanelLeft size={17} />
						</button>
					</div>
					<div className="eyebrow sidebar-label">工作台</div>
					<button
						type="button"
						aria-label="采集工作台"
						title={isSidebarCollapsed ? "采集工作台" : undefined}
						aria-current={page === "workspace" && !selectedTask ? "page" : undefined}
						className={
							page === "workspace" && !selectedTask ? "nav-active" : "nav-muted"
						}
						onClick={() => {
							setPage("workspace");
							setSelected(undefined);
							setTab("messages");
						}}
					>
						<List size={16} />
						<span className="sidebar-label">采集工作台</span>
					</button>
					<button
						type="button"
						aria-label="连接与权限"
						title={isSidebarCollapsed ? "连接与权限" : undefined}
						aria-current={page === "connections" ? "page" : undefined}
						className={page === "connections" ? "nav-active" : "nav-muted"}
						onClick={() => {
							completeOnboarding();
							setSelected(undefined);
							setPage("connections");
						}}
					>
						<Settings2 size={16} />
						<span className="sidebar-label">连接与权限</span>
					</button>
					<div className="task-label">
						<span className="sidebar-label task-label-text">
							全部任务 <span>{total}</span>
						</span>
						<button
							title="新建采集任务"
							aria-label="新建采集任务"
							onClick={() => setCreateOpen(true)}
						>
							<Plus size={16} />
						</button>
					</div>
					<div className="task-list">
						{tasks.map((task) => (
							<button
								aria-label={task.name}
								title={isSidebarCollapsed ? task.name : undefined}
								aria-current={
									page === "workspace" && selected === task.id
										? "page"
										: undefined
								}
								className={
									page === "workspace" && selected === task.id
										? "task-selected"
										: ""
								}
								key={task.id}
								onClick={() => {
									setPage("workspace");
									completeOnboarding();
									setSelected(task.id);
								}}
							>
								<i className={`platform ${task.source.platform}`}>
									{task.source.platform === "telegram" ? "TG" : "DC"}
								</i>
								<span className="sidebar-label">{task.name}</span>
							</button>
						))}
					</div>
					<div className="sidebar-bottom">
						<div className="eyebrow sidebar-label">桌面应用</div>
						<div className="connection" title="Telegram">
							<b aria-hidden="true">
								<img src={telegramIcon} alt="" width={16} height={16} />
							</b>
							<span className="sidebar-label">Telegram</span>
							<small
								className={
									runtimeInfo?.apps.telegram ? "connection-ready" : undefined
								}
							>
								{runtimeInfo
									? runtimeInfo.apps.telegram
										? "已安装"
										: "未安装"
									: "未检测"}
							</small>
						</div>
						<div className="connection" title="Discord">
							<b aria-hidden="true">
								<img src={discordIcon} alt="" width={16} height={16} />
							</b>
							<span className="sidebar-label">Discord</span>
							<small
								className={
									runtimeInfo?.apps.discord ? "connection-ready" : undefined
								}
							>
								{runtimeInfo
									? runtimeInfo.apps.discord
										? "已安装"
										: "未安装"
									: "未检测"}
							</small>
						</div>
						<button
							className="support"
							aria-label="联系客服"
							title="联系客服"
							onClick={() => window.copyfast.openExternal("support")}
						>
							<span className="support-icons" aria-hidden="true">
								<img src={discordIcon} alt="" width={16} height={16} />
								<img src={telegramIcon} alt="" width={16} height={16} />
							</span>
							<span className="sidebar-label">联系客服</span>
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
					<section className={`content${isWorkspaceExpanded ? " content-expanded" : ""}`}>
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
								<button
									className="secondary"
									onClick={() => setTab(tab === "rules" ? "messages" : "rules")}
								>
									<Settings2 size={15} />
									{tab === "rules" ? "返回消息" : "采集规则"}
								</button>
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
													(message) => message.status !== "filtered",
												).length,
											)
										: String(
												state.messages.filter(
													(message) => message.status !== "filtered",
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
						{tab === "rules" ? (
							<Rules
								task={currentTask}
								onSaved={async (input) => {
									if (!currentTask) return;
									await window.copyfast.saveTask(input, currentTask.id);
									setState(await window.copyfast.state());
								}}
							/>
						) : (
							<ChannelWorkspace
								key={selectedTask?.id ?? "all"}
								state={state}
								taskId={selectedTask?.id}
								isExpanded={isWorkspaceExpanded}
								onToggleExpanded={() => setIsPanelExpanded(!isPanelExpanded)}
								tab={tab}
								onTabChange={setTab}
								onRefresh={async () => {
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
