import { Check, X } from "lucide-react";
import { useState } from "react";

import type { Platform, Scope, TaskInput } from "../../shared/contracts";

import "./task-dialog.css";

type Props = { onClose: () => void; onSaved: (input: TaskInput) => void };
type ScopeDraft = { platform: Platform; serverId: string; serverName: string; channels: string };

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
	const [target, setTarget] = useState<ScopeDraft>(emptyScope("discord"));
	const [collector, setCollector] = useState("");
	const [deliveryKind, setDeliveryKind] =
		useState<TaskInput["delivery"]["kind"]>("discord-webhook");
	const [endpoint, setEndpoint] = useState("");
	const [secret, setSecret] = useState("");
	const [chatId, setChatId] = useState("");
	const [interval, setInterval] = useState(60);
	const [include, setInclude] = useState("");
	const [exclude, setExclude] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setError("");
		setSaving(true);
		try {
			if (!collector.trim()) throw new Error("请选择本机采集程序");
			if (!secret.trim()) throw new Error("请输入目标平台密钥");
			if (deliveryKind === "telegram-bot" && !chatId.trim())
				throw new Error("Telegram 同步需要目标 chat ID");
			const input: TaskInput = {
				name,
				source: toScope(source),
				target: toScope(target),
				collector: { executable: collector.trim(), args: [] },
				delivery: {
					kind: deliveryKind,
					endpoint: endpoint.trim(),
					secretId: "prototype-secret",
					...(chatId.trim() ? { chatId: chatId.trim() } : {}),
				},
				rules: {
					intervalSeconds: interval,
					startAt: new Date().toISOString(),
					include,
					exclude,
					maxRetries: 3,
					retrySeconds: 10,
					text: true,
					images: true,
					attachments: true,
				},
			};
			onSaved(input);
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
			<form className="task-dialog" onSubmit={submit}>
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
				<div className="dialog-body">
					<label className="field">
						任务名称
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="例如：产品社区更新"
							required
							maxLength={80}
						/>
					</label>
					<div className="scope-columns">
						<ScopeFields title="采集来源" value={source} onChange={setSource} />
						<ScopeFields title="同步目标" value={target} onChange={setTarget} />
					</div>
					<section className="form-section">
						<div className="section-heading">
							<b>采集程序</b>
							<span>界面原型，稍后接入本机执行</span>
						</div>
						<div className="file-picker">
							<input
								value={collector}
								onChange={(event) => setCollector(event.target.value)}
								placeholder="例如：/path/to/collector"
								required
							/>
						</div>
						<small>此阶段仅演示配置界面，不会启动该程序。</small>
					</section>
					<section className="form-section">
						<div className="section-heading">
							<b>同步配置</b>
							<span>凭据加密保存在本机系统安全存储中</span>
						</div>
						<div className="form-grid">
							<label className="field">
								同步方式
								<select
									value={deliveryKind}
									onChange={(event) =>
										setDeliveryKind(
											event.target.value as TaskInput["delivery"]["kind"],
										)
									}
								>
									<option value="discord-webhook">Discord Webhook</option>
									<option value="telegram-bot">Telegram Bot</option>
									<option value="signal-webhook">CopyFast 信号 Webhook</option>
								</select>
							</label>
							<label className="field">
								目标地址
								<input
									value={endpoint}
									onChange={(event) => setEndpoint(event.target.value)}
									placeholder={
										deliveryKind === "telegram-bot"
											? "https://api.telegram.org"
											: "https://…"
									}
									required
									type="url"
								/>
							</label>
							<label className="field">
								访问密钥
								<input
									value={secret}
									onChange={(event) => setSecret(event.target.value)}
									type="password"
									autoComplete="new-password"
									required
									placeholder="不会写入任务文件"
								/>
							</label>
							{deliveryKind === "telegram-bot" && (
								<label className="field">
									目标 chat ID
									<input
										value={chatId}
										onChange={(event) => setChatId(event.target.value)}
										required
									/>
								</label>
							)}
						</div>
					</section>
					<section className="form-section">
						<div className="section-heading">
							<b>采集规则</b>
							<span>保存后可在任务规则页继续调整</span>
						</div>
						<div className="form-grid">
							<label className="field">
								采集间隔（秒）
								<input
									type="number"
									min={10}
									max={86400}
									value={interval}
									onChange={(event) => setInterval(Number(event.target.value))}
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
					{error && (
						<div className="form-error" role="alert">
							{error}
						</div>
					)}
				</div>
				<footer className="dialog-footer">
					<span>新任务会先以暂停状态保存到本机</span>
					<button type="button" className="secondary" onClick={onClose}>
						取消
					</button>
					<button className="primary" disabled={saving}>
						<Check size={15} />
						{saving ? "保存中…" : "保存任务"}
					</button>
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
