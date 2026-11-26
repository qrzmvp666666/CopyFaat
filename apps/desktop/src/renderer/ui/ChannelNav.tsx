import { Hash, Layers, Search } from "lucide-react";
import { useState } from "react";

import type { ChannelEntry } from "./channel-view";

interface ChannelNavProps {
	channels: ChannelEntry[];
	selectedKey?: string;
	onSelect: (key?: string) => void;
}

export function ChannelNav({ channels, selectedKey, onSelect }: ChannelNavProps) {
	const [query, setQuery] = useState("");
	const visible = channels.filter((channel) =>
		`${channel.name} ${channel.serverName} ${channel.taskName}`
			.toLocaleLowerCase()
			.includes(query.trim().toLocaleLowerCase()),
	);
	const groups = [...new Set(visible.map((channel) => channel.taskId))];
	return (
		<aside className="channel-nav" aria-label="频道导航">
			<label className="channel-search">
				<Search size={13} />
				<input
					aria-label="搜索频道"
					placeholder="查找来源、频道或任务"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</label>
			<button
				className={!selectedKey ? "channel-active" : ""}
				aria-pressed={!selectedKey}
				onClick={() => onSelect()}
			>
				<Layers size={14} />
				<span>全部频道</span>
				<small>{channels.reduce((sum, channel) => sum + channel.count, 0)}</small>
			</button>
			<div className="channel-groups">
				{groups.map((taskId) => (
					<section key={taskId}>
						<h3 title={visible.find((channel) => channel.taskId === taskId)?.taskName}>
							{visible.find((channel) => channel.taskId === taskId)?.serverName}
						</h3>
						{visible
							.filter((channel) => channel.taskId === taskId)
							.map((channel) => (
								<button
									key={channel.key}
									title={`${channel.serverName} / #${channel.name}`}
									className={selectedKey === channel.key ? "channel-active" : ""}
									aria-pressed={selectedKey === channel.key}
									onClick={() => onSelect(channel.key)}
								>
									<Hash size={14} />
									<span>{channel.name}</span>
									<small>{channel.count}</small>
								</button>
							))}
					</section>
				))}
			</div>
			{!channels.length && (
				<p className="channel-empty">创建任务并选择频道后，频道会显示在这里。</p>
			)}
			{channels.length > 0 && !visible.length && (
				<p className="channel-empty">没有找到匹配的频道</p>
			)}
		</aside>
	);
}
