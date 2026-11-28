import {
	CircleAlert,
	Crown,
	ExternalLink,
	List,
	MoreHorizontal,
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
import type { PublicState, RuntimeInfo } from "../../shared/contracts";
import { ChannelWorkspace } from "./ChannelWorkspace";
import { Connections } from "./Connections";
import { TaskDetails } from "./TaskDetails";
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
	const [rulesDirty, setRulesDirty] = useState(false);
	const [rulesBusy, setRulesBusy] = useState(false);
	const [rulesEditing, setRulesEditing] = useState(false);
	function canLeaveRules() {
		return (
			!rulesBusy && (!rulesDirty || window.confirm("规则尚未保存，确定放弃修改并离开吗？"))
		);
	}
	const [accountPanel, setAccountPanel] = useState<"profile" | "membership" | null>(null);
	useEffect(() => {
		void window.copyfast.state().then(setState);
		return window.copyfast.onState(setState);
	}, []);
	useEffect(
		() =>
			window.copyfast.onNavigate((target) => {
				if (
					rulesBusy ||
					(rulesDirty && !window.confirm("规则尚未保存，确定放弃修改并离开吗？"))
				)
					return;
				setPage("workspace");
				if (target.tab) setTab(target.tab);
				if (target.taskId) {
					setSelected(target.taskId);
				}
			}),
		[rulesBusy, rulesDirty],
	);
	useEffect(() => {
		if (page !== "connections") return;
		let cancelled = false;
		const refreshRuntime = async (showFailure = false) => {
			try {
				const info = normalizeRuntimeInfo(await window.copyfast.runtime());
				if (cancelled) return;
				setRuntimeInfo(info);
				if (info.permissions.accessibility) setConnectionMessage(undefined);
			} catch {
				if (!cancelled && showFailure)
					setConnectionMessage("暂时无法读取本机状态，请稍后重试。");
			}
		};
		setIsCheckingRuntime(true);
		void refreshRuntime(true).finally(() => {
			if (!cancelled) setIsCheckingRuntime(false);
		});
		const onFocus = () => void refreshRuntime();
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") void refreshRuntime();
		};
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisibilityChange);
		const timer = window.setInterval(() => void refreshRuntime(), 2000);
		return () => {
			cancelled = true;
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.clearInterval(timer);
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
		<main
			className={`app-shell${onboardingOpen ? " onboarding-open" : ""}${tab === "rules" ? " task-details-shell" : ""}`}
		>
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
							if (!canLeaveRules()) return;
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
							if (!canLeaveRules()) return;
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
							onClick={() => {
								if (canLeaveRules()) setCreateOpen(true);
							}}
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
									if (selected === task.id && page === "workspace") return;
									if (!canLeaveRules()) return;
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
					<section
						className={`content${isWorkspaceExpanded ? " content-expanded" : ""}${tab === "rules" ? " task-detail-content" : ""}`}
					>
						<div className="content-head">
							<div>
								<div className="eyebrow">
									{selectedTask
										? `任务 / ${selectedTask.source.platform === "telegram" ? "Telegram" : "Discord"}`
										: "工作区 / 本机采集"}
								</div>
								<div className="task-detail-title">
									<h1>{selectedTask?.name ?? "采集工作台"}</h1>
									{tab === "rules" && current && (
										<span className={`detail-task-status ${current.status}`}>
											{current.status === "running"
												? "运行中"
												: current.status === "attention"
													? "需处理"
													: "已暂停"}
										</span>
									)}
								</div>
								<p>
									{selectedTask
										? `${current?.source.server.name ?? "来源未配置"} · ${current?.source.channels.length ?? 0} 个频道`
										: "统一查看本机采集结果与执行记录。"}
								</p>
							</div>
							<div className="content-head-actions">
								<button
									className="secondary"
									onClick={() => {
										if (canLeaveRules())
											setTab(tab === "rules" ? "messages" : "rules");
									}}
								>
									<Settings2 size={15} />
									{tab === "rules" ? "返回消息" : "采集规则"}
								</button>
								{selectedTask && current && (
									<>
										<button
											className="secondary"
											disabled={rulesBusy || rulesEditing}
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
										<details className="task-actions-menu">
											<summary aria-label="更多任务操作">
												<MoreHorizontal size={18} />
											</summary>
											<div>
												<button
													className="secondary danger-action"
													title="删除任务"
													disabled={rulesBusy}
													onClick={() => {
														if (!canLeaveRules()) return;
														if (
															!window.confirm(
																`删除“${current.name}”？该任务关联的频道消息和任务日志也会永久删除，此操作无法撤销。`,
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
												<button
													type="button"
													disabled={rulesBusy}
													onClick={() => {
														if (canLeaveRules()) setCreateOpen(true);
													}}
												>
													<Plus size={15} />
													新建任务
												</button>
											</div>
										</details>
									</>
								)}
								<button
									className={`primary${tab === "rules" ? " detail-hide-create" : ""}`}
									onClick={() => {
										if (canLeaveRules()) setCreateOpen(true);
									}}
								>
									<Plus size={16} /> 新建任务
								</button>
							</div>
						</div>
						<div className="metrics">
							{tab !== "rules" && (
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
							)}
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
							{tab === "rules" && (
								<Metric
									label="最近采集"
									value={
										current?.lastRunAt
											? new Date(current.lastRunAt).toLocaleString("zh-CN", {
													month: "numeric",
													day: "numeric",
													hour: "2-digit",
													minute: "2-digit",
												})
											: "尚未开始"
									}
								/>
							)}
						</div>
						{tab === "rules" ? (
							currentTask ? (
								<TaskDetails
									key={currentTask.id}
									task={currentTask}
									onDirtyChange={setRulesDirty}
									onBusyChange={setRulesBusy}
									onEditingChange={setRulesEditing}
									onRefresh={async () => {
										setState(await window.copyfast.state());
									}}
								/>
							) : (
								<Panel>
									<Empty
										title="选择一个任务查看采集规则"
										detail="从左侧选择任务，或新建任务开始配置。"
									/>
								</Panel>
							)
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
