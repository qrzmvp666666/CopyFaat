import { ArrowRight, Hash, Info, Pencil, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	discordWebhookUrlSchema,
	taskInputSchema,
	type PublicTask,
	type TaskInput,
} from "../../shared/contracts";
import {
	formatFrequency,
	getCollectionStartAt,
	type CollectionStartRange,
} from "./task-configuration";

import "./task-details.css";

interface TaskDetailsProps {
	task: PublicTask;
	onDirtyChange: (dirty: boolean) => void;
	onBusyChange: (busy: boolean) => void;
	onEditingChange: (editing: boolean) => void;
	onRefresh: () => Promise<void>;
}

interface RuleDraft {
	startRange: "keep" | CollectionStartRange;
	intervalSeconds: number;
	include: string;
	exclude: string;
	text: boolean;
	images: boolean;
	attachments: boolean;
	markRead: boolean;
}

export function TaskDetails({
	task,
	onDirtyChange,
	onBusyChange,
	onEditingChange,
	onRefresh,
}: TaskDetailsProps) {
	const [editing, setEditing] = useState(false);
	const [editingReceiver, setEditingReceiver] = useState(false);
	const [draft, setDraft] = useState(() => getRuleDraft(task));
	const [receiver, setReceiver] = useState(task.receiver);
	const [customFrequency, setCustomFrequency] = useState(
		![30, 60, 300].includes(draft.intervalSeconds),
	);
	const [saving, setSaving] = useState<"save" | "run" | null>(null);
	const [message, setMessage] = useState("");
	const [isError, setIsError] = useState(false);
	const submitting = useRef(false);
	const baseline = useRef({ rules: getRuleDraft(task), receiver: task.receiver });
	const isEditing = editing || editingReceiver;
	const dirty =
		isEditing &&
		(JSON.stringify(draft) !== JSON.stringify(baseline.current.rules) ||
			JSON.stringify(receiver) !== JSON.stringify(baseline.current.receiver));
	const shownReceiver = isEditing ? receiver : task.receiver;
	const configured = task.source.channels.filter((channel) => {
		const mapping = shownReceiver?.channels.find((item) => item.sourceChannelId === channel.id);
		return (
			mapping &&
			mapping.target.name.trim() &&
			discordWebhookUrlSchema.safeParse(mapping.webhookUrl).success
		);
	}).length;
	const canRun =
		configured === task.source.channels.length &&
		configured > 0 &&
		task.source.platform === "discord";

	useEffect(() => {
		onDirtyChange(dirty);
		return () => onDirtyChange(false);
	}, [dirty, onDirtyChange]);
	useEffect(() => {
		onBusyChange(saving !== null);
		return () => onBusyChange(false);
	}, [saving, onBusyChange]);
	useEffect(() => {
		onEditingChange(isEditing);
		return () => onEditingChange(false);
	}, [isEditing, onEditingChange]);
	useEffect(() => {
		function beforeUnload(event: BeforeUnloadEvent) {
			if (!dirty && !submitting.current) return;
			event.preventDefault();
			event.returnValue = "";
		}
		window.addEventListener("beforeunload", beforeUnload);
		return () => window.removeEventListener("beforeunload", beforeUnload);
	}, [dirty]);

	function beginEdit(section: "rules" | "receiver") {
		if (!isEditing) {
			const rules = getRuleDraft(task);
			baseline.current = { rules, receiver: task.receiver };
			setDraft(rules);
			setReceiver(task.receiver);
			setCustomFrequency(![30, 60, 300].includes(rules.intervalSeconds));
		}
		setMessage("");
		setIsError(false);
		if (section === "rules") setEditing(true);
		else setEditingReceiver(true);
	}

	function cancel() {
		setDraft(getRuleDraft(task));
		setReceiver(task.receiver);
		setEditing(false);
		setEditingReceiver(false);
		setMessage("");
		setIsError(false);
	}

	function updateMapping(sourceChannelId: string, key: "name" | "webhookUrl", value: string) {
		setReceiver((current) => {
			const channels = task.source.channels.map(
				(channel) =>
					current?.channels.find((item) => item.sourceChannelId === channel.id) ?? {
						sourceChannelId: channel.id,
						target: { id: "", name: channel.name },
						webhookUrl: "",
					},
			);
			return {
				platform: "discord",
				channels: channels.map((channel) =>
					channel.sourceChannelId !== sourceChannelId
						? channel
						: key === "name"
							? { ...channel, target: { ...channel.target, name: value } }
							: { ...channel, webhookUrl: value.trim() },
				),
			};
		});
	}

	async function save(run: boolean) {
		if (submitting.current) return;
		const { startRange = "keep", ...rules } = draft;
		const input: TaskInput = {
			name: task.name,
			source: task.source,
			collector: task.collector,
			receiver,
			startPaused: true,
			rules: {
				...task.rules,
				...rules,
				startAt:
					startRange === "keep" ? task.rules.startAt : getCollectionStartAt(startRange),
			},
		};
		const result = taskInputSchema.safeParse(input);
		if (!result.success || (run && !canRun)) {
			setMessage(
				result.success
					? "请先为每个来源频道配置有效的 Discord 接收地址。"
					: result.error.issues[0]?.path.includes("intervalSeconds")
						? "检查间隔必须是 10 至 86400 秒之间的整数。"
						: "请检查接收频道名称、Webhook 地址和规则配置。",
			);
			setIsError(true);
			return;
		}
		submitting.current = true;
		setSaving(run ? "run" : "save");
		setMessage("");
		setIsError(false);
		let saved = false;
		try {
			await window.copyfast.saveTask(result.data, task.id);
			saved = true;
			baseline.current = { rules: draft, receiver };
			setEditing(false);
			setEditingReceiver(false);
			if (run) await window.copyfast.taskAction(task.id, "resume");
			setMessage(run ? "规则已保存，任务已启动。" : "规则已保存，任务已暂停。");
		} catch (error) {
			const detail = error instanceof Error ? error.message : "请稍后重试";
			setIsError(true);
			setMessage(
				saved
					? `规则已保存，任务未启动：${detail}。可点击「运行任务」重试。`
					: `保存失败：${detail}。修改已保留。`,
			);
		} finally {
			try {
				await onRefresh();
			} catch {
				setIsError(true);
				setMessage(
					saved
						? "规则已保存，但状态刷新失败，请重新打开此任务查看。"
						: "保存失败，修改已保留，请重试。",
				);
			}
			submitting.current = false;
			setSaving(null);
		}
	}

	return (
		<div className="task-details" aria-busy={saving !== null}>
			<section className="detail-card" aria-labelledby="channel-mapping-title">
				<div className="detail-section-head">
					<div>
						<h2 id="channel-mapping-title">频道对应关系</h2>
						<p>每一行是一组来源频道与接收频道</p>
					</div>
					<div className="detail-section-actions">
						<span className="detail-badge">
							{configured} / {task.source.channels.length} 组已配置
						</span>
						<button
							type="button"
							disabled={!!saving || editingReceiver}
							onClick={() => beginEdit("receiver")}
						>
							<Pencil size={14} />
							编辑对应
						</button>
					</div>
				</div>
				<div className="mapping-scroll" role="region" aria-label="来源与接收频道对应表">
					<table className="mapping-table">
						<thead>
							<tr>
								<th scope="col">
									采集来源{" "}
									<span>
										{task.source.platform === "discord"
											? "Discord"
											: "Telegram"}{" "}
										· {task.source.server.name}
									</span>
								</th>
								<th scope="col">
									<span className="sr-only">对应</span>
								</th>
								<th scope="col">
									接收目标 <span>Discord · Webhook</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{task.source.channels.map((channel) => {
								const destination = shownReceiver?.channels.find(
									(item) => item.sourceChannelId === channel.id,
								);
								const valid =
									!!destination &&
									discordWebhookUrlSchema.safeParse(destination.webhookUrl)
										.success;
								return (
									<tr key={channel.id}>
										<td>
											<div className="mapping-channel">
												<span className="channel-hash">
													<Hash size={15} />
												</span>
												<span title={channel.name}>{channel.name}</span>
											</div>
										</td>
										<td>
											<ArrowRight size={17} aria-hidden="true" />
										</td>
										<td>
											{editingReceiver ? (
												<div className="mapping-edit">
													<label>
														<span className="sr-only">
															{channel.name} 的接收频道名称
														</span>
														<input
															disabled={!!saving}
															maxLength={160}
															value={
																destination?.target.name ??
																channel.name
															}
															onChange={(event) =>
																updateMapping(
																	channel.id,
																	"name",
																	event.target.value,
																)
															}
														/>
													</label>
													<label>
														<span className="sr-only">
															{channel.name} 的 Webhook 地址
														</span>
														<input
															disabled={!!saving}
															type="password"
															autoComplete="off"
															spellCheck={false}
															placeholder="Discord Webhook 地址"
															value={destination?.webhookUrl ?? ""}
															onChange={(event) =>
																updateMapping(
																	channel.id,
																	"webhookUrl",
																	event.target.value,
																)
															}
														/>
													</label>
												</div>
											) : (
												<div className="mapping-target">
													<div className="mapping-channel">
														<span className="channel-hash">
															<Hash size={15} />
														</span>
														<span title={destination?.target.name}>
															{destination?.target.name ||
																"尚未配置接收频道"}
														</span>
													</div>
													<span
														className={
															valid
																? "mapping-state"
																: "mapping-state missing"
														}
													>
														{valid ? "地址已配置" : "待配置"}
													</span>
												</div>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p className="detail-note">
					<Info size={13} />
					接收地址仅表示已配置，实际投递结果请在消息与执行记录中查看。
				</p>
			</section>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void save(false);
				}}
			>
				<section
					className={`detail-card${editing ? " detail-card-editing" : ""}`}
					aria-labelledby="collection-rules-title"
				>
					<div className="detail-section-head">
						<div>
							<h2 id="collection-rules-title">
								{editing ? "编辑采集规则" : "采集规则"}
							</h2>
							<p>
								{editing
									? "修改仅在保存后生效，不会立即改变当前任务。"
									: "查看当前配置，编辑后再选择保存方式。"}
							</p>
						</div>
						{editing ? (
							<span className={`detail-badge${dirty ? " unsaved" : ""}`}>
								{dirty ? "有未保存修改" : "编辑中"}
							</span>
						) : (
							<button
								type="button"
								disabled={!!saving}
								onClick={() => beginEdit("rules")}
							>
								<Pencil size={14} />
								编辑规则
							</button>
						)}
					</div>
					{editing ? (
						<fieldset className="detail-rule-controls" disabled={!!saving}>
							<legend className="sr-only">采集规则</legend>
							<div className="detail-start-range">
								<label htmlFor="collection-start-range">采集起点</label>
								<select
									id="collection-start-range"
									aria-describedby="collection-start-help"
									value={draft.startRange ?? "keep"}
									onChange={(event) =>
										setDraft({
											...draft,
											startRange: event.target
												.value as RuleDraft["startRange"],
										})
									}
								>
									<option value="keep">
										保留原采集起点（{formatStartAt(task.rules.startAt)}）
									</option>
									<option value="new">从现在开始</option>
									<option value="hour">最近 1 小时的消息</option>
									<option value="day">最近 24 小时的消息</option>
								</select>
								<p id="collection-start-help">
									新起点按保存时刻计算；采集仍受频道未读状态和当前可读取消息范围限制，已记录的消息不会重复采集。
								</p>
							</div>
							<div className="detail-rule-fields">
								<div className="detail-frequency">
									<span id="frequency-label">检查频率</span>
									<div
										className="frequency-options"
										role="group"
										aria-labelledby="frequency-label"
									>
										{[30, 60, 300].map((seconds) => (
											<button
												key={seconds}
												type="button"
												aria-pressed={
													!customFrequency &&
													draft.intervalSeconds === seconds
												}
												onClick={() => {
													setCustomFrequency(false);
													setDraft({
														...draft,
														intervalSeconds: seconds,
													});
												}}
											>
												{formatFrequency(seconds)}
											</button>
										))}
										<button
											type="button"
											aria-pressed={customFrequency}
											onClick={() => setCustomFrequency(true)}
										>
											自定义
										</button>
									</div>
									{customFrequency && (
										<label className="custom-interval">
											间隔（秒）
											<input
												type="number"
												required
												min={10}
												max={86400}
												step={1}
												value={
													Number.isNaN(draft.intervalSeconds)
														? ""
														: draft.intervalSeconds
												}
												onChange={(event) =>
													setDraft({
														...draft,
														intervalSeconds: event.target.valueAsNumber,
													})
												}
											/>
										</label>
									)}
								</div>
								<label>
									仅包含关键词
									<input
										maxLength={500}
										placeholder="不限，采集所有消息"
										value={draft.include}
										onChange={(event) =>
											setDraft({ ...draft, include: event.target.value })
										}
									/>
								</label>
								<label>
									排除关键词
									<input
										maxLength={500}
										placeholder="输入关键词，多个用逗号分隔"
										value={draft.exclude}
										onChange={(event) =>
											setDraft({ ...draft, exclude: event.target.value })
										}
									/>
								</label>
							</div>
							<div className="detail-content-options">
								<span>采集内容</span>
								{(
									[
										["text", "文字"],
										["images", "图片"],
										["attachments", "文件"],
									] as const
								).map(([key, label]) => (
									<label key={key}>
										<input
											type="checkbox"
											checked={draft[key]}
											onChange={(event) =>
												setDraft({ ...draft, [key]: event.target.checked })
											}
										/>
										{label}
									</label>
								))}
							</div>
							<label className="detail-post-process">
								<span>采集后处理</span>
								<span>滚动至最新消息并标记已读</span>
								<input
									className="detail-switch"
									type="checkbox"
									role="switch"
									checked={draft.markRead}
									onChange={(event) =>
										setDraft({ ...draft, markRead: event.target.checked })
									}
								/>
							</label>
						</fieldset>
					) : (
						<>
							<div className="detail-start-range detail-start-summary">
								<span>采集起点</span>
								<time dateTime={task.rules.startAt}>
									{formatStartAt(task.rules.startAt)} 之后的未读消息
								</time>
							</div>
							<dl className="detail-rule-summary">
								{[
									[
										"检查频率",
										`每 ${formatFrequency(task.rules.intervalSeconds)}`,
									],
									["包含关键词", task.rules.include || "不限关键词"],
									["排除关键词", task.rules.exclude || "无"],
									[
										"采集内容",
										[
											task.rules.text && "文字",
											task.rules.images && "图片",
											task.rules.attachments && "文件",
										]
											.filter(Boolean)
											.join(" · ") || "不采集内容",
									],
								].map(([label, value]) => (
									<div key={label}>
										<dt>{label}</dt>
										<dd>{value}</dd>
									</div>
								))}
							</dl>
							<div className="detail-post-process">
								<span>采集后处理</span>
								<span>滚动至最新消息并标记已读</span>
								<span className="detail-badge">
									{task.rules.markRead ? "已开启" : "已关闭"}
								</span>
							</div>
						</>
					)}
				</section>
				<div className="detail-save-bar">
					<div className="detail-save-message" role={isError ? "alert" : "status"}>
						<strong
							className={isError ? "detail-error" : dirty ? "detail-unsaved" : ""}
						>
							{message ||
								(dirty
									? "规则尚未保存"
									: isEditing
										? "编辑任务配置"
										: "所有更改已保存")}
						</strong>
						<p>
							{isEditing
								? "仅保存会让任务暂停；保存并运行将使用新配置启动。"
								: task.status === "running"
									? "任务运行中，实际投递结果请查看执行记录。"
									: "任务当前未运行，点击「运行任务」后开始采集。"}
						</p>
						{isEditing && !canRun && (
							<p className="detail-unsaved">
								{task.source.platform !== "discord"
									? "当前版本仅支持 Discord 采集。"
									: "请补全接收配置后再保存并运行。"}
							</p>
						)}
					</div>
					<div className="detail-save-actions">
						{isEditing ? (
							<>
								<button type="button" disabled={!!saving} onClick={cancel}>
									取消修改
								</button>
								<button type="submit" disabled={!!saving}>
									{saving === "save" ? "保存中…" : "仅保存，不运行"}
								</button>
								<button
									type="button"
									className="primary"
									disabled={!!saving || !canRun}
									onClick={() => void save(true)}
								>
									<Play size={14} />
									{saving === "run" ? "保存并启动中…" : "保存并运行"}
								</button>
							</>
						) : (
							<button
								type="button"
								disabled={!!saving}
								onClick={() => beginEdit("rules")}
							>
								编辑规则
							</button>
						)}
					</div>
				</div>
			</form>
		</div>
	);
}

function getRuleDraft(task: PublicTask): RuleDraft {
	const { intervalSeconds, include, exclude, text, images, attachments, markRead } = task.rules;
	return {
		startRange: "keep",
		intervalSeconds,
		include,
		exclude,
		text,
		images,
		attachments,
		markRead,
	};
}

function formatStartAt(value: string): string {
	return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
