import type { Scope } from "../../shared/contracts";
import { formatFrequency, getWebhookHost, type ReceiverDraft } from "./task-configuration";

export interface TaskRuleDraft {
	name: string;
	intervalSeconds: number;
	customFrequency: boolean;
	firstRange: "new" | "hour" | "day";
	text: boolean;
	media: boolean;
	startPaused: boolean;
}

interface TaskRulesStepProps {
	rules: TaskRuleDraft;
	source: Scope;
	receiver: ReceiverDraft;
	onChange: (rules: TaskRuleDraft) => void;
}

const FREQUENCIES = [
	{ seconds: 30, label: "30 秒" },
	{ seconds: 60, label: "1 分钟" },
	{ seconds: 300, label: "5 分钟" },
];

export function TaskRulesStep({ rules, source, receiver, onChange }: TaskRulesStepProps) {
	return (
		<>
			<div className="dialog-intro rules-intro">
				<h3>设置采集节奏</h3>
				<p>确认任务配置，按自己的使用习惯调整采集频率。</p>
			</div>
			<div className="rules-columns">
				<section className="rules-controls" aria-label="采集规则">
					<label className="rules-field rules-name">
						任务名称
						<input
							value={rules.name}
							maxLength={80}
							placeholder="例如：产品社区更新"
							onChange={(event) => onChange({ ...rules, name: event.target.value })}
						/>
					</label>
					<fieldset className="rules-frequency">
						<legend>检查频率</legend>
						<div className="rules-frequency-options">
							{FREQUENCIES.map((frequency) => (
								<button
									key={frequency.seconds}
									type="button"
									aria-pressed={
										!rules.customFrequency &&
										rules.intervalSeconds === frequency.seconds
									}
									onClick={() =>
										onChange({
											...rules,
											customFrequency: false,
											intervalSeconds: frequency.seconds,
										})
									}
								>
									{frequency.label}
								</button>
							))}
							<button
								type="button"
								aria-pressed={rules.customFrequency}
								onClick={() => onChange({ ...rules, customFrequency: true })}
							>
								自定义
							</button>
						</div>
						{rules.customFrequency && (
							<label className="rules-field rules-custom-frequency">
								检查间隔（秒）
								<input
									type="number"
									min={10}
									max={86400}
									step={1}
									value={
										Number.isNaN(rules.intervalSeconds)
											? ""
											: rules.intervalSeconds
									}
									onChange={(event) =>
										onChange({
											...rules,
											intervalSeconds: event.target.valueAsNumber,
										})
									}
								/>
							</label>
						)}
					</fieldset>
					<label className="rules-field rules-first-range">
						首次采集范围
						<select
							value={rules.firstRange}
							onChange={(event) =>
								onChange({
									...rules,
									firstRange: event.target.value as TaskRuleDraft["firstRange"],
								})
							}
						>
							<option value="new">从开始运行后新增的消息采集</option>
							<option value="hour">最近 1 小时的消息</option>
							<option value="day">最近 24 小时的消息</option>
						</select>
					</label>
					<fieldset className="rules-content">
						<legend>采集内容</legend>
						<div>
							<label>
								<input
									type="checkbox"
									checked={rules.text}
									onChange={(event) =>
										onChange({ ...rules, text: event.target.checked })
									}
								/>
								文字消息
							</label>
							<label>
								<input
									type="checkbox"
									checked={rules.media}
									onChange={(event) =>
										onChange({ ...rules, media: event.target.checked })
									}
								/>
								图片与附件信息
							</label>
						</div>
					</fieldset>
					<label className="rules-start-paused">
						<input
							type="checkbox"
							checked={rules.startPaused}
							onChange={(event) =>
								onChange({ ...rules, startPaused: event.target.checked })
							}
						/>
						创建后先暂停，稍后手动运行
					</label>
				</section>
				<aside className="rules-preview" aria-label="任务预览">
					<h4>任务预览</h4>
					<div className="rules-preview-source">
						<h5>采集来源</h5>
						<p>
							{source.platform === "discord" ? "Discord" : "Telegram"} /{" "}
							{source.server.name}
						</p>
						<p>{source.channels.map((channel) => channel.name).join(" · ")}</p>
					</div>
					<div className="rules-preview-receiver">
						<h5>消息接收</h5>
						<p>{getWebhookHost(receiver.webhookUrl)}</p>
						<p>
							{receiver.serverName || "待设置接收位置"} · {source.channels.length}{" "}
							组频道关联
						</p>
					</div>
					<p className="rules-preview-frequency">
						每{" "}
						{Number.isFinite(rules.intervalSeconds)
							? formatFrequency(rules.intervalSeconds)
							: "—"}
						检查 · 自动去重
					</p>
					<p className="rules-preview-note">采集失败保留记录，可在任务日志中重试。</p>
				</aside>
			</div>
		</>
	);
}
