import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import discordIcon from "../../../assets/discord-monochrome.svg";
import telegramIcon from "../../../assets/telegram-monochrome.svg";
import {
	scopeSchema,
	taskInputSchema,
	type Platform,
	type RuntimeInfo,
	type Scope,
	type TaskInput,
} from "../../shared/contracts";
import { buildReceiver, createReceiverDraft, validateReceiver } from "./task-configuration";
import { TaskReceiverStep } from "./TaskReceiverStep";
import { TaskRulesStep, type TaskRuleDraft } from "./TaskRulesStep";

import "./task-dialog.css";
import "./task-configuration.css";

interface Props {
	onClose: () => void;
	onSaved: (input: TaskInput) => Promise<void>;
}
interface ScopeDraft {
	platform: Platform;
	serverId: string;
	serverName: string;
	channels: string;
}
const STEPS = ["选择平台", "定位来源", "频道与接收", "采集规则"];
const PLATFORMS = [
	{ id: "discord", name: "Discord", icon: discordIcon, description: "服务器与频道" },
	{ id: "telegram", name: "Telegram", icon: telegramIcon, description: "群组与频道" },
] as const;
const emptyScope = (platform: Platform): ScopeDraft => ({
	platform,
	serverId: "",
	serverName: "",
	channels: "",
});

function parseChannels(value: string): Scope["channels"] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [id, ...name] = line.split("|");
			return { id: id.trim(), name: name.join("|").trim() || id.trim() };
		});
}

export function TaskDialog({ onClose, onSaved }: Props) {
	const [rules, setRules] = useState<TaskRuleDraft>({
		name: "",
		intervalSeconds: 60,
		customFrequency: false,
		firstRange: "new",
		text: true,
		media: true,
		startPaused: false,
	});
	const [receiver, setReceiver] = useState(() => createReceiverDraft("discord"));
	const [excludedChannelIds, setExcludedChannelIds] = useState<string[]>([]);
	const [source, setSource] = useState<ScopeDraft>(emptyScope("discord"));
	const [collector, setCollector] = useState("");
	const [sourceSettingsOpen, setSourceSettingsOpen] = useState(false);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [step, setStep] = useState(0);
	const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
	const [busy, setBusy] = useState(false);
	const [permissionMessage, setPermissionMessage] = useState("");
	const dialogRef = useRef<HTMLFormElement>(null);
	const platform = PLATFORMS.find((item) => item.id === source.platform)!;
	const installed = runtime?.apps[source.platform];
	const sourceScope = toScope(source);
	const selectedChannels = sourceScope.channels.filter(
		(channel) => !excludedChannelIds.includes(channel.id),
	);
	const selectedSource = { ...sourceScope, channels: selectedChannels };

	useEffect(() => {
		let active = true;
		void window.copyfast
			.runtime()
			.then((info) => {
				if (active) setRuntime(info);
			})
			.catch(() => {
				if (active) setError("无法读取应用安装状态，请稍后重试。");
			});
		const previousFocus = document.activeElement;
		dialogRef.current?.focus();
		return () => {
			active = false;
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		};
	}, []);

	async function openPlatform(startSelection: boolean) {
		setBusy(true);
		setError("");
		try {
			const opened = await window.copyfast.launchDesktopApp(source.platform);
			if (!opened) {
				setRuntime((current) =>
					current
						? {
								...current,
								apps: { ...current.apps, [source.platform]: false },
							}
						: current,
				);
				setError(`未能打开 ${platform.name}，请先安装桌面应用后重试。`);
				return;
			}
			setStep(startSelection ? 2 : 1);
			if (startSelection) setPermissionMessage("");
		} catch {
			setError(`无法打开 ${platform.name}，请稍后重试。`);
		} finally {
			setBusy(false);
		}
	}

	async function checkPermissions() {
		setBusy(true);
		setError("");
		try {
			await window.copyfast.requestAccessibilityPermission();
			const info = await window.copyfast.runtime();
			setRuntime(info);
			const missing = [
				!info.permissions.accessibility && "桌面操作",
				!["granted", "not-required"].includes(info.permissions.screen) && "屏幕读取",
			].filter(Boolean);
			setPermissionMessage(
				missing.length
					? `请在系统设置中开启${missing.join("与")}权限，完成后重新检查。`
					: info.permissions.screen === "not-required"
						? "桌面操作权限已开启；当前采集方式无需屏幕读取权限。"
						: "桌面操作与屏幕读取权限已开启。",
			);
		} catch {
			setError("无法检查权限，请稍后重试。");
		} finally {
			setBusy(false);
		}
	}

	function validateSource() {
		if (!source.serverName.trim() || !source.serverId.trim())
			return "请填写采集来源的服务器名称和 ID";
		if (!scopeSchema.safeParse(sourceScope).success)
			return "请填写有效的来源信息与频道，频道 ID 不可重复，最多可配置 100 个频道";
		if (!collector.trim()) return "请选择本机采集程序";
		return "";
	}

	function validateStep(index: number) {
		if (index === 2) {
			const sourceError = validateSource();
			if (sourceError) setSourceSettingsOpen(true);
			return sourceError || validateReceiver(receiver, selectedChannels);
		}
		if (index === 3) {
			if (!rules.name.trim()) return "请填写任务名称";
			if (
				!Number.isInteger(rules.intervalSeconds) ||
				rules.intervalSeconds < 10 ||
				rules.intervalSeconds > 86400
			)
				return "采集间隔需为 10 到 86400 秒之间的整数";
			if (!rules.text && !rules.media) return "请至少选择一种采集内容";
		}
		return "";
	}

	function goToStep(nextStep: number) {
		if (nextStep > step) {
			const validationError = validateStep(step);
			if (validationError) {
				setError(validationError);
				return;
			}
		}
		setError("");
		if (step === 2 && nextStep === 3 && !rules.name.trim())
			setRules({ ...rules, name: `${source.serverName.trim()}更新`.slice(0, 80) });
		setStep(nextStep);
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		const validationError = [2, 3].map(validateStep).find(Boolean);
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		setError("");
		try {
			const lookbackSeconds =
				rules.firstRange === "day" ? 86400 : rules.firstRange === "hour" ? 3600 : 0;
			const input = taskInputSchema.parse({
				name: rules.name.trim(),
				startPaused: rules.startPaused,
				source: selectedSource,
				receiver: buildReceiver(receiver, selectedChannels),
				collector: { executable: collector.trim(), args: [] },
				rules: {
					intervalSeconds: rules.intervalSeconds,
					startAt: new Date(Date.now() - lookbackSeconds * 1000).toISOString(),
					include: "",
					exclude: "",
					maxRetries: 0,
					retrySeconds: 10,
					text: rules.text,
					images: rules.media,
					attachments: rules.media,
				},
			});
			await onSaved(input);
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "任务保存失败");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className={`modal-backdrop${step === 1 ? " modal-backdrop--guide" : step === 2 ? " modal-backdrop--receiver" : ""}`}
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget && !saving && !busy) onClose();
			}}
		>
			<form
				ref={dialogRef}
				className={`task-dialog${step === 1 ? " task-dialog--guide" : step === 2 ? " task-dialog--receiver" : step === 3 ? " task-dialog--rules" : ""}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="task-dialog-title"
				tabIndex={-1}
				onSubmit={(event) => {
					if (step < STEPS.length - 1) event.preventDefault();
					else void submit(event);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						if (!saving && !busy) onClose();
					}
					if (event.key === "Tab") {
						const controls = Array.from(
							event.currentTarget.querySelectorAll<HTMLElement>(
								"button:not(:disabled), input, select, textarea, [tabindex='0']",
							),
						);
						const first = controls[0];
						const last = controls.at(-1);
						if (
							event.shiftKey &&
							(document.activeElement === first ||
								document.activeElement === event.currentTarget)
						) {
							event.preventDefault();
							last?.focus();
						} else if (!event.shiftKey && document.activeElement === last) {
							event.preventDefault();
							first?.focus();
						}
					}
				}}
				noValidate
			>
				<header className="dialog-head">
					<div>
						<h2 id="task-dialog-title">新建采集任务</h2>
						<p>
							{step === 2
								? "选择采集频道，并设置消息发送到哪里。"
								: step === 1
									? "选择采集来源，连接你关心的消息。"
									: "连接你的频道，把消息送到需要的地方。"}
						</p>
					</div>
					<button
						type="button"
						className="dialog-close"
						aria-label="关闭新建任务"
						onClick={onClose}
						disabled={saving || busy}
					>
						<X size={24} strokeWidth={1.25} />
					</button>
				</header>
				<nav className="dialog-steps" aria-label="新建任务步骤">
					{STEPS.map((title, index) => (
						<button
							aria-current={step === index ? "step" : undefined}
							className={
								step === index
									? "dialog-step active"
									: step > index
										? "dialog-step complete"
										: "dialog-step"
							}
							key={title}
							type="button"
							onClick={() => index < step && goToStep(index)}
							disabled={index > step || saving || busy}
						>
							<span>{step > index ? <Check size={13} /> : index + 1}</span>
							{title}
						</button>
					))}
				</nav>
				<div
					className={`dialog-body${step < 2 ? " dialog-body--intro" : step === 2 ? " dialog-body--receiver" : step === 3 ? " dialog-body--rules" : ""}`}
				>
					{step === 0 && (
						<>
							<div className="dialog-intro">
								<h3>先选择采集来源</h3>
								<p>选择后打开桌面应用，再定位要采集的服务器或群组。</p>
							</div>
							<div className="platform-options" role="group" aria-label="采集平台">
								{PLATFORMS.map((item) => (
									<button
										key={item.id}
										type="button"
										className="platform-option"
										aria-pressed={source.platform === item.id}
										onClick={() => {
											if (source.platform !== item.id) {
												setSource(emptyScope(item.id));
												setExcludedChannelIds([]);
												setReceiver(createReceiverDraft(item.id));
											}
											setError("");
											setPermissionMessage("");
										}}
									>
										<span className="platform-mark">
											<img src={item.icon} alt="" width={32} height={32} />
										</span>
										<span className="platform-radio" aria-hidden="true" />
										<span className="platform-name">{item.name}</span>
										<span className="platform-description">
											{item.description}
										</span>
									</button>
								))}
							</div>
							<div className="platform-installation">
								<div>
									<p className={installed ? "app-installed" : ""}>
										{platform.name}{" "}
										{installed === undefined
											? "· 正在检查安装状态…"
											: installed
												? "已安装"
												: "未安装"}
									</p>
									<p>下一步会唤起 {platform.name}。请确认已登录，再开始框选。</p>
								</div>
								<button
									type="button"
									onClick={() => {
										void window.copyfast
											.openExternal(source.platform)
											.catch(() =>
												setError("无法打开下载页面，请稍后重试。"),
											);
									}}
								>
									未安装？获取应用 ↗
								</button>
							</div>
						</>
					)}
					{step === 1 && (
						<>
							<div className="dialog-intro">
								<h3>去 {platform.name}，选择采集范围</h3>
								<p>
									接下来会暂时收起 CopyFast，在 {platform.name} 窗口上完成选择。
								</p>
							</div>
							<div className="selection-guide">
								<ol className="selection-instructions">
									<li>
										<span>1</span>
										<div>
											<h4>确认窗口</h4>
											<p>
												打开已登录的 {platform.name}，切换到需要采集的
												{source.platform === "discord" ? "服务器" : "群组"}
												。
											</p>
										</div>
									</li>
									<li>
										<span>2</span>
										<div>
											<h4>
												框选
												{source.platform === "discord" ? "服务器" : "群组"}
												与频道
											</h4>
											<p>
												跟随底部提示，依次框选
												{source.platform === "discord" ? "服务器" : "群组"}
												名称和频道列表区域。
											</p>
										</div>
									</li>
									<li>
										<span>3</span>
										<div>
											<h4>返回确认结果</h4>
											<p>勾选需要采集的频道，再设置接收地址与采集频率。</p>
										</div>
									</li>
								</ol>
								<aside className="selection-source">
									<div className="selection-source-heading">
										<span>
											<img
												src={platform.icon}
												alt=""
												width={28}
												height={28}
											/>
										</span>
										<div>
											<h4>{platform.name}</h4>
											<p>
												{installed
													? "已安装 · 请确认已登录"
													: "请确认已安装并登录"}
											</p>
										</div>
									</div>
									<h5>主窗口会暂时收起</h5>
									<p>操作期间按 Esc 可取消，随后返回当前设置。</p>
								</aside>
							</div>
							<div className="permission-check">
								<div>
									<h4>开始前检查</h4>
									<p role="status">
										{permissionMessage ||
											"桌面操作与屏幕读取权限；若未开启，将先引导你完成授权。"}
									</p>
								</div>
								<button
									type="button"
									className="secondary"
									disabled={busy}
									onClick={() => void checkPermissions()}
								>
									检查权限
								</button>
							</div>
						</>
					)}
					{step === 2 && (
						<TaskReceiverStep
							source={sourceScope}
							receiver={receiver}
							selectedChannels={selectedChannels}
							onChange={setReceiver}
							onSelectionChange={(ids) =>
								setExcludedChannelIds(
									sourceScope.channels
										.filter((channel) => !ids.includes(channel.id))
										.map((channel) => channel.id),
								)
							}
							onChangeSource={() => setSourceSettingsOpen((open) => !open)}
							sourceSettings={
								sourceSettingsOpen ? (
									<section
										className="receiver-source-settings"
										aria-label="配置采集来源"
									>
										<div className="form-notice" role="status">
											当前版本暂不支持自动框选，请手动填写来源与频道信息。
										</div>
										<div className="scope-columns">
											<ScopeFields
												title="采集来源"
												value={source}
												onChange={setSource}
											/>
										</div>
										<section className="form-section">
											<div className="section-heading">
												<b>本机采集程序</b>
												<span>选择本机已准备好的采集脚本</span>
											</div>
											<div className="file-picker">
												<input
													aria-label="本机采集程序"
													value={collector}
													readOnly
													placeholder="尚未选择"
												/>
												<button
													type="button"
													className="secondary"
													onClick={async () => {
														try {
															const path =
																await window.copyfast.chooseCollector();
															if (path) setCollector(path);
														} catch {
															setError(
																"无法打开文件选择器，请重试。",
															);
														}
													}}
												>
													选择文件
												</button>
											</div>
											<small>
												任务会通过所选程序读取消息，并将结果保存在本机。
											</small>
										</section>

										<button
											type="button"
											className="secondary"
											onClick={() => {
												const sourceError = validateSource();
												setError(sourceError);
												if (!sourceError) setSourceSettingsOpen(false);
											}}
										>
											保存来源配置
										</button>
									</section>
								) : null
							}
						/>
					)}
					{step === 3 && (
						<TaskRulesStep
							rules={rules}
							source={selectedSource}
							receiver={receiver}
							onChange={setRules}
						/>
					)}
					{error && (
						<div className="form-error" role="alert">
							{error}
						</div>
					)}
				</div>
				<footer className="dialog-footer">
					<span>
						{step === 3
							? "创建后可随时暂停或调整规则"
							: step === 2
								? `已选择 ${selectedChannels.length} 个频道 · 配置会保留，可返回修改`
								: step === 1
									? "配置会保留，可返回修改"
									: "设置会保留，可返回上一步修改"}
					</span>
					{step > 0 && (
						<button
							type="button"
							className="secondary"
							disabled={saving || busy}
							onClick={() => goToStep(step - 1)}
						>
							上一步
						</button>
					)}
					{step < 2 ? (
						<button
							type="button"
							className="primary"
							disabled={busy}
							onClick={() => void openPlatform(step === 1)}
						>
							{busy
								? "请稍候…"
								: step === 0
									? `打开 ${platform.name} 并继续`
									: `打开 ${platform.name}，开始选择`}
						</button>
					) : step < STEPS.length - 1 ? (
						<button
							key="next"
							type="button"
							className="primary"
							onClick={(event) => {
								event.preventDefault();
								goToStep(step + 1);
							}}
						>
							下一步：采集规则
						</button>
					) : (
						<button key="save" type="submit" className="primary" disabled={saving}>
							{saving ? "创建中…" : rules.startPaused ? "创建任务" : "创建并开始采集"}
						</button>
					)}
				</footer>
			</form>
		</div>
	);
}

function toScope(draft: ScopeDraft): Scope {
	return {
		platform: draft.platform,
		server: { id: draft.serverId.trim(), name: draft.serverName.trim() },
		channels: parseChannels(draft.channels),
	};
}

function ScopeFields({
	title,
	value,
	onChange,
}: {
	title: string;
	value: ScopeDraft;
	onChange: (value: ScopeDraft) => void;
}) {
	return (
		<section className="scope-form">
			<div className="section-heading">
				<b>{title}</b>
			</div>
			<div className="form-grid">
				<label className="field">
					服务器 / 群组名称
					<input
						required
						value={value.serverName}
						onChange={(event) => onChange({ ...value, serverName: event.target.value })}
						placeholder="名称"
					/>
				</label>
				<label className="field">
					服务器 / 群组 ID
					<input
						required
						value={value.serverId}
						onChange={(event) => onChange({ ...value, serverId: event.target.value })}
						placeholder="平台中的稳定 ID"
					/>
				</label>
			</div>
			<label className="field">
				频道范围
				<textarea
					required
					rows={3}
					value={value.channels}
					onChange={(event) => onChange({ ...value, channels: event.target.value })}
					placeholder={"每行一个：频道 ID | 显示名称\n例如：12345 | 产品公告"}
				/>
			</label>
			<small>服务器只选一个；可添加多个频道。ID 需与采集程序返回值一致。</small>
		</section>
	);
}
