import { ArrowRight, Hash, Search } from "lucide-react";
import { useState } from "react";

import discordIcon from "../../../assets/discord-monochrome.svg";
import telegramIcon from "../../../assets/telegram-monochrome.svg";
import { discordWebhookUrlSchema, type Scope } from "../../shared/contracts";
import { getReceiverChannel, setChannelWebhook, type ReceiverDraft } from "./task-configuration";

interface TaskReceiverStepProps {
	notice?: string;
	source: Scope;
	receiver: ReceiverDraft;
	selectedChannels: Scope["channels"];
	onChange: (receiver: ReceiverDraft) => void;
	onSelectionChange: (ids: string[]) => void;
	onChangeSource: () => void;
}

export function TaskReceiverStep({
	notice,
	source,
	receiver,
	selectedChannels,
	onChange,
	onSelectionChange,
	onChangeSource,
}: TaskReceiverStepProps) {
	const [search, setSearch] = useState("");
	const [showUrls, setShowUrls] = useState(false);
	const [touchedIds, setTouchedIds] = useState<Set<string>>(new Set());
	const channels = source.channels.filter((channel) =>
		channel.name.toLowerCase().includes(search.trim().toLowerCase()),
	);
	const selectedIds = new Set(selectedChannels.map((channel) => channel.id));
	const allSelected =
		channels.length > 0 && channels.every((channel) => selectedIds.has(channel.id));
	const mappedCount = selectedChannels.filter(
		(channel) =>
			discordWebhookUrlSchema.safeParse(
				getReceiverChannel(receiver, channel.id)?.webhookUrl.trim(),
			).success,
	).length;
	const sourcePlatform = source.platform === "discord" ? "Discord" : "Telegram";

	function selectVisible() {
		const ids = new Set(selectedIds);
		for (const channel of channels) {
			if (allSelected) ids.delete(channel.id);
			else ids.add(channel.id);
		}
		onSelectionChange([...ids]);
	}

	return (
		<div className="channel-receiver">
			<div className="dialog-intro receiver-intro">
				{notice && (
					<p className="receiver-discovery-notice" role="status">
						{notice}
					</p>
				)}
				<h3>选择来源，填写接收 Webhook</h3>
				<p>
					勾选要采集的频道，在每行填写目标频道的 Webhook
					地址。发到同一个位置时，可填写相同地址。
				</p>
			</div>
			<div className="channel-server-flow">
				<ServerCard
					label="来源服务器"
					name={source.server.name || "尚未配置来源"}
					detail={`${sourcePlatform} · 已识别 ${source.channels.length} 个频道`}
					icon={source.platform === "discord" ? discordIcon : telegramIcon}
					action="更换"
					onAction={onChangeSource}
				/>
				<ArrowRight
					className="channel-server-arrow"
					size={28}
					strokeWidth={1.4}
					aria-hidden="true"
				/>
				<ServerCard
					label="接收位置"
					name="Discord 目标频道"
					detail="每个来源单独填写 Webhook，无需添加接收频道"
					icon={discordIcon}
				/>
			</div>
			<div className="channel-toolbar">
				<label className="channel-search">
					<Search size={15} aria-hidden="true" />
					<input
						aria-label="搜索来源频道"
						placeholder="搜索来源频道"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</label>
				<span>
					已选择 {selectedChannels.length} / {source.channels.length} 个频道
				</span>
				<label className="channel-reveal-urls">
					<input
						type="checkbox"
						checked={showUrls}
						onChange={(event) => setShowUrls(event.target.checked)}
					/>
					显示 Webhook 地址
				</label>
			</div>
			<div
				className="channel-mapping-table"
				role="table"
				aria-label="来源频道与接收 Webhook 对应关系"
			>
				<div className="channel-table-header" role="row">
					<div role="columnheader" className="channel-source-cell">
						<input
							type="checkbox"
							aria-label="全选当前搜索结果"
							checked={allSelected}
							ref={(node) => {
								if (node)
									node.indeterminate =
										!allSelected &&
										channels.some((channel) => selectedIds.has(channel.id));
							}}
							disabled={!channels.length}
							onChange={selectVisible}
						/>
						<span>来源频道</span>
					</div>
					<span aria-hidden="true" />
					<div role="columnheader">目标频道的 Webhook 地址</div>
				</div>
				<div className="channel-table-scroll">
					{channels.map((channel, index) => {
						const checked = selectedIds.has(channel.id);
						const value = getReceiverChannel(receiver, channel.id)?.webhookUrl ?? "";
						const invalid =
							checked &&
							touchedIds.has(channel.id) &&
							!discordWebhookUrlSchema.safeParse(value.trim()).success;
						const errorId = `channel-webhook-error-${index}`;
						return (
							<div
								role="row"
								key={channel.id}
								className={`channel-table-row${checked ? " is-selected" : ""}`}
							>
								<label
									role="cell"
									className="channel-source-cell"
									title={channel.name}
								>
									<input
										type="checkbox"
										checked={checked}
										aria-label={`采集 ${channel.name}`}
										onChange={(event) =>
											onSelectionChange(
												event.target.checked
													? [...selectedIds, channel.id]
													: [...selectedIds].filter(
															(id) => id !== channel.id,
														),
											)
										}
									/>
									<Hash size={13} aria-hidden="true" />
									<span>{channel.name}</span>
								</label>
								<ArrowRight
									className="channel-row-arrow"
									size={21}
									strokeWidth={1.3}
									aria-hidden="true"
								/>
								<div role="cell" className="channel-webhook-cell">
									<input
										className="channel-webhook-input"
										aria-label={`${channel.name}的接收 Webhook 地址`}
										type={showUrls ? "text" : "password"}
										autoComplete="off"
										spellCheck={false}
										maxLength={2048}
										placeholder="粘贴目标频道的 Discord Webhook 地址"
										disabled={!checked}
										value={value}
										aria-invalid={invalid}
										aria-describedby={invalid ? errorId : undefined}
										onChange={(event) =>
											onChange(
												setChannelWebhook(
													receiver,
													channel,
													event.target.value,
												),
											)
										}
										onBlur={() =>
											setTouchedIds((ids) => new Set([...ids, channel.id]))
										}
									/>
									{invalid && (
										<small className="channel-webhook-error" id={errorId}>
											请填写有效的 Discord Webhook 地址
										</small>
									)}
								</div>
							</div>
						);
					})}
					{!channels.length && (
						<p className="channel-empty">
							{source.channels.length
								? "没有匹配的来源频道，试试其他关键词"
								: "尚未识别到频道，请更换来源或重新识别"}
						</p>
					)}
				</div>
			</div>
			<div className="channel-table-meta">
				<span>
					显示 {channels.length} / {source.channels.length} 个频道 · 向下滚动查看更多
				</span>
				<span
					className={
						mappedCount > 0 && mappedCount === selectedChannels.length
							? "channel-mapped"
							: ""
					}
				>
					已配置 {mappedCount} / {selectedChannels.length} 个频道 ·
					仅检查地址格式，尚未联网验证
				</span>
			</div>
			<p className="channel-webhook-help">
				获取地址：Discord 目标频道设置 → 整合 → Webhook → 复制 Webhook
				URL。当前仅保存配置，不会发送消息。
			</p>
		</div>
	);
}

function ServerCard({
	label,
	name,
	detail,
	icon,
	action,
	onAction,
}: {
	label: string;
	name: string;
	detail: string;
	icon: string;
	action?: string;
	onAction?: () => void;
}) {
	return (
		<section className="channel-server-card" aria-label={label}>
			<span className="channel-platform-icon">
				<img src={icon} alt="" width={24} height={24} />
			</span>
			<div className="channel-server-identity">
				<span>{label}</span>
				<h4 title={name}>{name}</h4>
				<p>{detail}</p>
			</div>
			{action && onAction && (
				<button type="button" className="channel-button" onClick={onAction}>
					{action}
				</button>
			)}
		</section>
	);
}
