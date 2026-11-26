import {
	ChevronLeft,
	ChevronRight,
	FileText,
	Maximize2,
	Minimize2,
	RefreshCw,
	Search,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Message, PublicState } from "../../shared/contracts";
import { getChannels, getChannelLogs, messageInChannel, type ChannelLogRow } from "./channel-view";
import { ChannelNav } from "./ChannelNav";

import "./channel-workspace.css";

interface ChannelWorkspaceProps {
	state: PublicState;
	taskId?: string;
	isExpanded: boolean;
	onToggleExpanded: () => void;
	tab: string;
	onTabChange: (tab: string) => void;
	onRefresh: () => Promise<void>;
}
const labels: Record<ChannelLogRow["status"], string> = {
	processing: "采集中",
	success: "成功",
	skipped: "无新增",
	failed: "失败",
	uncertain: "未完成",
	retrying: "等待重试",
};
const PAGE_SIZE = 20;
export function ChannelWorkspace({
	state,
	taskId,
	isExpanded,
	onToggleExpanded,
	tab,
	onTabChange,
	onRefresh,
}: ChannelWorkspaceProps) {
	const channels = getChannels(state, taskId);
	const [selection, setSelection] = useState<string | null | undefined>(undefined);
	const channel = channels.find(
		(entry) => entry.key === (selection === undefined && taskId ? channels[0]?.key : selection),
	);
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState("all");
	const [period, setPeriod] = useState("all");
	const [page, setPage] = useState(0);
	const [detail, setDetail] = useState<Message>();
	const [refreshing, setRefreshing] = useState(false);
	const [refreshError, setRefreshError] = useState("");
	const messages = state.messages.filter(
		(message) =>
			(!taskId || message.taskId === taskId) &&
			messageInChannel(message, channel) &&
			message.status !== "filtered",
	);
	const logs = getChannelLogs(state, taskId, channel);
	const latest = logs[0];
	const lastSuccess = logs.find((row) => row.status === "success" || row.status === "skipped");
	const search = query.trim().toLocaleLowerCase();
	const filteredMessages = messages
		.filter(
			(message) =>
				`${message.text} ${message.author} ${message.channelName ?? message.channelId}`
					.toLocaleLowerCase()
					.includes(search) &&
				(period === "all" ||
					new Date(message.collectedAt).toDateString() === new Date().toDateString()),
		)
		.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
	const filteredLogs = logs.filter(
		(row) =>
			(status === "all" || row.status === status) &&
			`${row.channel?.name ?? ""} ${row.log.error ?? ""} ${row.result?.error ?? ""}`
				.toLocaleLowerCase()
				.includes(search),
	);
	const count = tab === "logs" ? filteredLogs.length : filteredMessages.length;
	const currentPage = Math.min(page, Math.max(0, Math.ceil(count / PAGE_SIZE) - 1));
	function changeChannel(key?: string) {
		setSelection(key ?? null);
		setPage(0);
		setDetail(undefined);
	}
	async function refresh() {
		setRefreshing(true);
		setRefreshError("");
		try {
			await onRefresh();
		} catch {
			setRefreshError("刷新失败，请重试");
		} finally {
			setRefreshing(false);
		}
	}
	return (
		<div className="channel-workspace">
			<ChannelNav channels={channels} selectedKey={channel?.key} onSelect={changeChannel} />
			<section className="channel-content" aria-label="频道内容">
				<header className="channel-heading">
					<button
						type="button"
						className="channel-expand"
						aria-label={isExpanded ? "还原频道面板" : "放大频道面板"}
						title={isExpanded ? "还原频道面板" : "放大频道面板"}
						aria-pressed={isExpanded}
						onClick={onToggleExpanded}
					>
						{isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
					</button>
					<h2>{channel ? `# ${channel.name}` : "全部频道"}</h2>
					<div className="channel-summary">
						{channel && latest && (
							<span className={`channel-status status-${latest.status}`}>
								{labels[latest.status]}
							</span>
						)}
						<span>{messages.length} 条已保存消息</span>
						{channel && lastSuccess && (
							<span>
								最近完成{" "}
								{formatDate(
									lastSuccess.log.finishedAt ?? lastSuccess.log.startedAt,
								)}
							</span>
						)}
					</div>
				</header>
				<div className="channel-tabs" role="tablist" aria-label="频道记录类型">
					<button
						role="tab"
						aria-selected={tab === "messages"}
						onClick={() => {
							onTabChange("messages");
							setPage(0);
							setQuery("");
						}}
						className={tab === "messages" ? "selected" : ""}
					>
						消息列表 <span>{messages.length}</span>
					</button>
					<button
						role="tab"
						aria-selected={tab === "logs"}
						onClick={() => {
							onTabChange("logs");
							setPage(0);
							setQuery("");
						}}
						className={tab === "logs" ? "selected" : ""}
					>
						任务日志 <span>{logs.length}</span>
					</button>
					<button
						className="channel-refresh"
						aria-label="刷新频道记录"
						disabled={refreshing}
						onClick={() => void refresh()}
					>
						<RefreshCw size={13} />
						{refreshing ? "刷新中" : "刷新"}
					</button>
				</div>
				<div className="channel-toolbar">
					{tab === "logs" ? (
						<div className="log-status-filters">
							{(
								[
									"all",
									"processing",
									"success",
									"failed",
									"skipped",
									"retrying",
									"uncertain",
								] as const
							).map((value) => (
								<button
									key={value}
									aria-pressed={status === value}
									className={status === value ? "selected" : ""}
									onClick={() => {
										setStatus(value);
										setPage(0);
									}}
								>
									{value === "all" ? "全部" : labels[value]}{" "}
									<span>
										{
											logs.filter(
												(row) => value === "all" || row.status === value,
											).length
										}
									</span>
								</button>
							))}
						</div>
					) : (
						<select
							aria-label="消息时间范围"
							value={period}
							onChange={(event) => {
								setPeriod(event.target.value);
								setPage(0);
							}}
						>
							<option value="all">全部时间</option>
							<option value="today">今天</option>
						</select>
					)}
					<label className="channel-content-search">
						<Search size={13} />
						<input
							aria-label={tab === "logs" ? "搜索日志" : "搜索消息"}
							placeholder={tab === "logs" ? "搜索频道或异常内容" : "搜索消息或作者"}
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setPage(0);
							}}
						/>
					</label>
				</div>
				{refreshError && <p role="alert">{refreshError}</p>}
				<div
					className="channel-records"
					role="tabpanel"
					aria-label={tab === "logs" ? "任务日志" : "消息列表"}
				>
					{tab === "logs"
						? filteredLogs
								.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
								.map((row) => (
									<article className="channel-log" key={row.key}>
										<div className="channel-log-title">
											<span className={`channel-status status-${row.status}`}>
												{labels[row.status]}
											</span>
											<time>{formatDate(row.log.startedAt)}</time>
											<small>
												{row.log.durationMs !== undefined
													? `${(row.log.durationMs / 1000).toFixed(1)} 秒`
													: "执行中"}
											</small>
										</div>
										{!channel && (
											<h3>
												{row.channel
													? `# ${row.channel.name}`
													: (row.log.taskName ?? "历史任务")}
											</h3>
										)}
										<p>
											{row.legacy
												? `任务批次统计 · 发现 ${row.log.collected} · 保存 ${row.log.saved} · 跳过 ${row.log.ignored}`
												: row.result?.status === "uncertain"
													? "本轮未取得完整结果，频道数量尚未确认"
													: `本频道发现 ${row.result?.collected ?? 0} 条 · 保存 ${row.result?.saved ?? 0} 条 · 跳过 ${row.result?.ignored ?? 0} 条`}
										</p>
										{row.legacy && <small>历史记录未单独统计频道数量</small>}
										{(row.result?.error || row.log.error) && (
											<p className="channel-log-error">
												{row.result?.error ?? row.log.error}
											</p>
										)}
										{row.status === "retrying" && row.log.retryAt && (
											<p>计划重试 {formatDate(row.log.retryAt)}</p>
										)}
										<footer>
											<small>
												批次 {row.log.id.slice(0, 8)}
												{row.log.attempt
													? ` · 第 ${row.log.attempt} 次重试`
													: ""}
											</small>
											<button
												disabled={
													!messages.some(
														(message) =>
															message.batchId === row.log.id &&
															(!row.result ||
																message.channelId ===
																	row.result.channelId),
													)
												}
												onClick={() => {
													const message = messages.find(
														(item) =>
															item.batchId === row.log.id &&
															(!row.result ||
																item.channelId ===
																	row.result.channelId),
													);
													if (message) {
														if (!channel)
															setSelection(
																channels.find(
																	(entry) =>
																		entry.taskId ===
																			message.taskId &&
																		entry.channelId ===
																			message.channelId,
																)?.key,
															);
														onTabChange("messages");
														setDetail(message);
														setPage(0);
														setQuery("");
													}
												}}
											>
												查看本轮消息 <ChevronRight size={12} />
											</button>
										</footer>
									</article>
								))
						: filteredMessages
								.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
								.map((message) => (
									<article className="channel-message" key={message.key}>
										<span className="message-avatar">
											{message.author.slice(0, 1).toUpperCase() || "?"}
										</span>
										<div className="message-body">
											<div className="message-meta">
												<strong>{message.author || "未知作者"}</strong>
												<time>{formatDate(message.sentAt)}</time>
											</div>
											{!channel && (
												<small>
													{message.taskName} / #
													{message.channelName ?? message.channelId}
												</small>
											)}
											<button
												className="message-text"
												onClick={() => setDetail(message)}
											>
												{message.text || "附件消息"}
											</button>
											{message.attachments.length > 0 && (
												<div className="message-files">
													{message.attachments.map((file, index) => (
														<span key={index}>
															<FileText size={13} />
															{file.name ||
																(file.kind === "image"
																	? "图片"
																	: "附件")}
														</span>
													))}
												</div>
											)}
											<small>
												保存于 {formatDate(message.collectedAt)} · 消息{" "}
												{message.id}
											</small>
										</div>
									</article>
								))}
					{!count && (
						<div className="channel-no-records">
							<FileText size={25} />
							<h3>
								{search || (status !== "all" && tab === "logs")
									? "没有匹配的记录"
									: tab === "logs"
										? "暂无采集日志"
										: "等待采集消息"}
							</h3>
							<p>
								{search
									? "试试其他关键词。"
									: "运行任务后，此频道的记录会显示在这里。"}
							</p>
						</div>
					)}
				</div>
				{count > 0 && (
					<footer className="channel-pagination">
						<small>
							共 {count} 条 · 第 {currentPage + 1} / {Math.ceil(count / PAGE_SIZE)} 页
						</small>
						<div>
							<button
								aria-label="上一页"
								disabled={currentPage === 0}
								onClick={() => setPage(currentPage - 1)}
							>
								<ChevronLeft size={14} />
							</button>
							<button
								aria-label="下一页"
								disabled={(currentPage + 1) * PAGE_SIZE >= count}
								onClick={() => setPage(currentPage + 1)}
							>
								<ChevronRight size={14} />
							</button>
						</div>
					</footer>
				)}
			</section>
			{detail && <MessageDetail detail={detail} onClose={() => setDetail(undefined)} />}
		</div>
	);
}
function formatDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "时间未知"
		: date.toLocaleString("zh-CN", { hour12: false });
}

function MessageDetail({ detail, onClose }: { detail: Message; onClose: () => void }) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, []);
	return (
		<dialog
			ref={ref}
			className="channel-message-detail"
			aria-label="消息详情"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
		>
			<header>
				<h2>消息详情</h2>
				<button aria-label="关闭消息详情" onClick={() => onClose()}>
					<X size={18} />
				</button>
			</header>
			<small>
				{detail.taskName} / #{detail.channelName ?? detail.channelId}
			</small>
			<h3>{detail.author}</h3>
			<time>{formatDate(detail.sentAt)}</time>
			<p>{detail.text || "附件消息"}</p>
			{detail.attachments.map((file, index) => (
				<p key={index}>
					<FileText size={14} /> {file.name || "附件"}
				</p>
			))}
			<small>
				保存于 {formatDate(detail.collectedAt)}
				<br />
				消息 ID {detail.id}
			</small>
		</dialog>
	);
}
