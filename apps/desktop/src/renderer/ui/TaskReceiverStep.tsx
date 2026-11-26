import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { Platform, Scope } from "../../shared/contracts";
import { buildReceiver, validateReceiver, type ReceiverDraft } from "./task-configuration";

interface TaskReceiverStepProps {
	source: Scope;
	sourceSettings?: ReactNode;
	receiver: ReceiverDraft;
	selectedChannels: Scope["channels"];
	onChange: (receiver: ReceiverDraft) => void;
	onSelectionChange: (ids: string[]) => void;
	onChangeSource: () => void;
}

export function TaskReceiverStep({
	source,
	sourceSettings,
	receiver,
	selectedChannels,
	onChange,
	onSelectionChange,
	onChangeSource,
}: TaskReceiverStepProps) {
	const [search, setSearch] = useState("");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewError, setPreviewError] = useState("");
	const channels = source.channels.filter((channel) =>
		channel.name.toLowerCase().includes(search.trim().toLowerCase()),
	);
	const selectedIds = new Set(selectedChannels.map((channel) => channel.id));
	const allSelected =
		channels.length > 0 && channels.every((channel) => selectedIds.has(channel.id));
	const platformName = source.platform === "discord" ? "Discord" : "Telegram";

	function updateTarget(id: string, field: "id" | "name", value: string) {
		const channel = source.channels.find((item) => item.id === id)!;
		onChange({
			...receiver,
			targets: {
				...receiver.targets,
				[id]: {
					...(receiver.targets[id] ?? { id: "", name: channel.name }),
					[field]: value,
				},
			},
		});
	}

	return (
		<>
			<div className="dialog-intro receiver-intro">
				<h3>选择频道与接收位置</h3>
				<p>先勾选来源频道，再为它们配置接收位置。</p>
			</div>
			{sourceSettings}
			<div className="receiver-columns">
				<section className="receiver-source-card" aria-label="来源服务器与频道">
					<div className="receiver-source-label">
						<span>来源服务器</span>
						<button type="button" onClick={onChangeSource}>
							{source.server.name ? "更换服务器 ↗" : "配置来源 ↗"}
						</button>
					</div>
					<div className="receiver-source-identity">
						<span>{source.platform === "discord" ? "DC" : "TG"}</span>
						<div>
							<h4>{source.server.name || "尚未配置来源"}</h4>
							<p>
								{platformName} · 已配置 {source.channels.length} 个频道
							</p>
						</div>
					</div>
					<label className="receiver-search">
						<Search size={14} aria-hidden="true" />
						<input
							aria-label="搜索频道名称"
							placeholder="搜索频道名称"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
						/>
					</label>
					<div className="receiver-select-all">
						<label>
							<input
								type="checkbox"
								checked={allSelected}
								disabled={channels.length === 0}
								ref={(element) => {
									if (element)
										element.indeterminate =
											!allSelected &&
											channels.some((channel) => selectedIds.has(channel.id));
								}}
								onChange={() => {
									const next = new Set(selectedIds);
									for (const channel of channels) {
										if (allSelected) next.delete(channel.id);
										else next.add(channel.id);
									}
									onSelectionChange([...next]);
								}}
							/>
							全选
						</label>
						<span>已选择 {selectedChannels.length} 个</span>
					</div>
					<p className="receiver-channel-category">信息发布</p>
					<div className="receiver-channel-list">
						{channels.map((channel) => (
							<label
								key={channel.id}
								className={`receiver-channel${selectedIds.has(channel.id) ? " is-selected" : ""}`}
							>
								<input
									type="checkbox"
									checked={selectedIds.has(channel.id)}
									onChange={() =>
										onSelectionChange(
											selectedIds.has(channel.id)
												? [...selectedIds].filter((id) => id !== channel.id)
												: [...selectedIds, channel.id],
										)
									}
								/>
								<span>#&nbsp; {channel.name}</span>
							</label>
						))}
						{channels.length === 0 && <p className="receiver-empty">没有匹配的频道</p>}
					</div>
					<p className="receiver-channel-count">
						显示 {channels.length} / {source.channels.length} 个频道 · 列表可滚动
					</p>
				</section>
				<section className="receiver-settings-card" aria-label="接收设置与频道对应关系">
					<div className="receiver-card-heading">
						<h4>接收设置</h4>
						<span>为所选频道设置统一接收地址</span>
					</div>
					<label className="receiver-field receiver-webhook">
						Webhook 地址
						<input
							type="url"
							value={receiver.webhookUrl}
							maxLength={2048}
							placeholder="https://your-domain.com/webhooks/messages"
							onChange={(event) =>
								onChange({ ...receiver, webhookUrl: event.target.value })
							}
						/>
					</label>
					<div className="receiver-destination-fields">
						<label className="receiver-field">
							目标平台
							<select
								value={receiver.platform}
								onChange={(event) =>
									onChange({
										...receiver,
										platform: event.target.value as Platform,
									})
								}
							>
								<option value="discord">Discord</option>
								<option value="telegram">Telegram</option>
							</select>
						</label>
						<label className="receiver-field">
							目标服务器名称
							<input
								value={receiver.serverName}
								maxLength={160}
								placeholder="我的工作室"
								onChange={(event) =>
									onChange({ ...receiver, serverName: event.target.value })
								}
							/>
						</label>
						<label className="receiver-field">
							服务器 ID（选填）
							<input
								value={receiver.serverId}
								maxLength={200}
								placeholder="输入服务器标识"
								onChange={(event) =>
									onChange({ ...receiver, serverId: event.target.value })
								}
							/>
						</label>
					</div>
					<div className="receiver-mapping-heading">
						<h4>频道对应关系</h4>
						<span>已选 {selectedChannels.length} 个频道</span>
						<p>目标频道默认沿用来源名称，可逐项修改</p>
					</div>
					<div className="receiver-mapping-labels">
						<span>来源频道 · {source.server.name}</span>
						<span>目标频道 · {receiver.serverName || "待设置"}</span>
						<span>频道 ID（选填）</span>
					</div>
					<div className="receiver-mapping-list">
						{selectedChannels.map((channel) => (
							<div className="receiver-mapping-row" key={channel.id}>
								<span className="receiver-mapping-source">
									#&nbsp; {channel.name}
									<span aria-hidden="true">→</span>
								</span>
								<div className="receiver-target-name">
									<span aria-hidden="true">#</span>
									<input
										aria-label={`${channel.name}的目标频道名称`}
										value={receiver.targets[channel.id]?.name ?? channel.name}
										maxLength={160}
										onChange={(event) =>
											updateTarget(channel.id, "name", event.target.value)
										}
									/>
								</div>
								<input
									aria-label={`${channel.name}的目标频道 ID`}
									value={receiver.targets[channel.id]?.id ?? ""}
									maxLength={200}
									placeholder="输入频道标识"
									onChange={(event) =>
										updateTarget(channel.id, "id", event.target.value)
									}
								/>
							</div>
						))}
						{selectedChannels.length === 0 && (
							<p className="receiver-empty">请从左侧勾选需要采集的频道</p>
						)}
					</div>
					<div className="receiver-test-row">
						<span>○ 尚未测试</span>
						<p>测试前可预览消息内容并确认发送</p>
						<button
							type="button"
							className="secondary"
							onClick={() => {
								const error = validateReceiver(receiver, selectedChannels);
								setPreviewError(error);
								if (!error) setPreviewOpen(true);
							}}
						>
							测试接收
						</button>
					</div>
					{previewError && (
						<p className="receiver-preview-error" role="alert">
							{previewError}
						</p>
					)}
				</section>
			</div>
			<div className="receiver-summary">
				<span>采集范围</span>
				<strong>
					{source.server.name} / {selectedChannels.length} 个频道
				</strong>
				<span aria-hidden="true">→</span>
				<strong>
					{receiver.serverName || "待设置接收位置"} / {selectedChannels.length} 组对应关系
				</strong>
				<span>仅发送已勾选频道的消息</span>
			</div>
			{previewOpen && (
				<section className="receiver-test-preview" aria-label="测试消息预览">
					<div className="receiver-card-heading">
						<h4>测试消息预览</h4>
						<button
							type="button"
							className="secondary"
							onClick={() => setPreviewOpen(false)}
						>
							关闭预览
						</button>
					</div>
					<p role="status">
						当前版本尚未接入 Webhook 发送服务。以下为配置预览，未发送测试消息。
					</p>
					<dl className="receiver-test-details">
						<dt>接收地址</dt>
						<dd>{receiver.webhookUrl.trim()}</dd>
						<dt>接收位置</dt>
						<dd>
							{receiver.serverName} · {selectedChannels.length} 个频道
						</dd>
						<dt>频道对应关系</dt>
						<dd>
							{buildReceiver(receiver, selectedChannels).channels.map((mapping) => (
								<div key={mapping.sourceChannelId}>
									{
										selectedChannels.find(
											(channel) => channel.id === mapping.sourceChannelId,
										)?.name
									}{" "}
									→ {mapping.target.name}
								</div>
							))}
						</dd>
						<dt>消息内容</dt>
						<dd className="receiver-test-message">
							这是一条 CopyFast 测试消息，用于确认接收位置配置。
						</dd>
					</dl>
				</section>
			)}
		</>
	);
}
