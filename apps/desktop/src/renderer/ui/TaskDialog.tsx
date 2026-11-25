import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useState } from "react";

import type { Platform, Scope, TaskInput } from "../../shared/contracts";

import "./task-dialog.css";

type Props = { onClose: () => void; onSaved: (input: TaskInput) => Promise<void> };
type ScopeDraft = { platform: Platform; serverId: string; serverName: string; channels: string };
const STEPS = ["任务与来源", "本机采集", "采集规则"];
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
	const [name, setName] = useState("");
	const [source, setSource] = useState<ScopeDraft>(emptyScope("discord"));
	const [collector, setCollector] = useState("");
	const [interval, setInterval] = useState(60);
	const [include, setInclude] = useState("");
	const [exclude, setExclude] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [step, setStep] = useState(0);

	function validateStep(index: number) {
		if (index === 0) {
			if (!name.trim()) return "请填写任务名称";
			if (!source.serverName.trim() || !source.serverId.trim())
				return "请填写采集来源的服务器名称和 ID";
			if (parseChannels(source.channels).length === 0) return "请至少添加一个采集频道";
		}
		if (index === 1 && !collector.trim()) return "请选择本机采集程序";
		if (index === 2 && (interval < 10 || interval > 86400))
			return "采集间隔需在 10 到 86400 秒之间";
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
		setStep(nextStep);
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		const validationError = validateStep(step);
		if (validationError) {
			setError(validationError);
			return;
		}
		setSaving(true);
		setError("");
		try {
			await onSaved({
				name: name.trim(),
				source: toScope(source),
				collector: { executable: collector.trim(), args: [] },
				rules: {
					intervalSeconds: interval,
					startAt: new Date().toISOString(),
					include,
					exclude,
					maxRetries: 0,
					retrySeconds: 10,
					text: true,
					images: true,
					attachments: true,
				},
			});
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "任务保存失败");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className="modal-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<form className="task-dialog" onSubmit={submit} noValidate>
				<header className="dialog-head">
					<div>
						<span className="eyebrow">本地任务配置</span>
						<h2>新建采集任务</h2>
					</div>
					<button
						type="button"
						className="icon-button"
						aria-label="关闭"
						onClick={onClose}
					>
						<X size={18} />
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
						>
							<span>{step > index ? <Check size={13} /> : index + 1}</span>
							{title}
						</button>
					))}
				</nav>
				<div className="dialog-body">
					{step === 0 && (
						<>
							<label className="field">
								任务名称
								<input
									value={name}
									onChange={(event) => setName(event.target.value)}
									placeholder="例如：产品社区更新"
									maxLength={80}
								/>
							</label>
							<div className="scope-columns">
								<ScopeFields title="采集来源" value={source} onChange={setSource} />
							</div>
						</>
					)}
					{step === 1 && (
						<section className="form-section">
							<div className="section-heading">
								<b>本机采集程序</b>
								<span>选择本机已准备好的采集脚本</span>
							</div>
							<div className="file-picker">
								<input value={collector} readOnly placeholder="尚未选择" />
								<button
									type="button"
									className="secondary"
									onClick={async () => {
										try {
											const path = await window.copyfast.chooseCollector();
											if (path) setCollector(path);
										} catch {
											setError("无法打开文件选择器，请重试。");
										}
									}}
								>
									选择文件
								</button>
							</div>
							<small>任务会通过所选程序读取消息，并将结果保存在本机。</small>
						</section>
					)}
					{step === 2 && (
						<section className="form-section">
							<div className="section-heading">
								<b>采集规则</b>
								<span>符合条件的内容会加入本地消息列表</span>
							</div>
							<div className="form-grid">
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
							</div>
						</section>
					)}
					{error && (
						<div className="form-error" role="alert">
							{error}
						</div>
					)}
				</div>
				<footer className="dialog-footer">
					<span>新任务会先以暂停状态保存在本机</span>
					{step > 0 && (
						<button
							type="button"
							className="secondary"
							onClick={() => goToStep(step - 1)}
						>
							<ArrowLeft size={14} />
							上一步
						</button>
					)}
					<button type="button" className="secondary" onClick={onClose}>
						取消
					</button>
					{step < STEPS.length - 1 ? (
						<button
							type="button"
							className="primary"
							onClick={() => goToStep(step + 1)}
						>
							下一步
							<ArrowRight size={14} />
						</button>
					) : (
						<button className="primary" disabled={saving}>
							<Check size={15} />
							{saving ? "保存中…" : "保存任务"}
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
				<select
					aria-label={`${title}平台`}
					value={value.platform}
					onChange={(event) =>
						onChange({ ...value, platform: event.target.value as Platform })
					}
				>
					<option value="discord">Discord</option>
					<option value="telegram">Telegram</option>
				</select>
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
