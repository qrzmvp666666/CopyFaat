import { useEffect, useState } from "react";

import type { DiscoveryProgress } from "../../shared/contracts";

import "./discovery-overlay.css";

export function DiscoveryOverlay() {
	const [progress, setProgress] = useState<DiscoveryProgress>({
		phase: "preparing",
		found: 0,
		message: "正在自动定位 Discord 频道侧栏…",
	});
	const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		document.documentElement.classList.add("discovery-document");
		let active = true;
		let receivedProgress = false;
		const unsubscribe = window.copyfast.onDiscoveryProgress((value) => {
			receivedProgress = true;
			setProgress(value);
			setPending(false);
			setError("");
		});
		void window.copyfast
			.discoveryOverlayState()
			.then((state) => {
				if (active && state && !receivedProgress) setProgress(state.progress);
			})
			.catch(() => {
				if (active) setError("无法读取识别状态，请按 Esc 重试。");
			});
		return () => {
			active = false;
			unsubscribe();
			document.documentElement.classList.remove("discovery-document");
		};
	}, []);
	async function decide(continueScanning?: boolean) {
		setPending(true);
		setError("");
		try {
			if (continueScanning === undefined) await window.copyfast.cancelDiscovery();
			else
				await window.copyfast.resolveDiscoveryExit(
					continueScanning,
					progress.channels
						?.filter((channel) => !excludedIds.has(channel.id))
						.map((channel) => channel.id),
				);
		} catch {
			setPending(false);
			setError("操作未完成，请重试。");
		}
	}
	const paused = progress.phase === "paused";
	const channels = progress.channels ?? [];
	const selectedCount = channels.filter((channel) => !excludedIds.has(channel.id)).length;
	const visibleChannels = channels.filter((channel) =>
		`${channel.name} ${channel.locator?.category ?? ""}`
			.toLocaleLowerCase()
			.includes(query.trim().toLocaleLowerCase()),
	);
	function toggleChannel(id: string) {
		setExcludedIds((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}
	return (
		<div className={`discovery-overlay${paused ? " discovery-overlay--confirm" : ""}`}>
			<div
				role={paused ? "alert" : "status"}
				aria-live="polite"
				className="discovery-summary"
			>
				<strong>
					{paused
						? "退出频道识别？"
						: progress.phase === "scanning"
							? `已发现 ${progress.found} 个频道`
							: "正在识别 Discord 当前服务器"}
				</strong>
				<span>
					{paused
						? `已识别 ${progress.found} 个频道${progress.serverName ? ` · ${progress.serverName}` : ""}`
						: `${progress.message} · Esc 退出`}
				</span>
			</div>
			{paused ? (
				<>
					<p className="discovery-confirm-hint">{progress.message}</p>
					{channels.length > 0 && (
						<>
							<input
								className="discovery-search"
								type="search"
								aria-label="搜索已识别频道"
								placeholder="搜索频道或分类"
								value={query}
								disabled={pending}
								onChange={(event) => setQuery(event.target.value)}
							/>
							<div className="discovery-selection">
								<span>
									已选择 {selectedCount} / {channels.length} 个频道
								</span>
								<div>
									<button
										type="button"
										disabled={pending}
										onClick={() => setExcludedIds(new Set())}
									>
										全选
									</button>
									<button
										type="button"
										disabled={pending}
										onClick={() =>
											setExcludedIds(
												new Set(channels.map((channel) => channel.id)),
											)
										}
									>
										清空
									</button>
								</div>
							</div>
						</>
					)}
					<ul className="discovery-found-channels" aria-label="已识别的频道">
						{visibleChannels.map((channel) => (
							<li key={channel.id}>
								<label className="discovery-channel-option">
									<input
										type="checkbox"
										checked={!excludedIds.has(channel.id)}
										disabled={pending}
										onChange={() => toggleChannel(channel.id)}
									/>
									<div>
										<span># {channel.name}</span>
										{channel.locator?.category && (
											<small>{channel.locator.category}</small>
										)}
									</div>
								</label>
							</li>
						))}
						{channels.length > 0 && !visibleChannels.length && (
							<li className="discovery-empty">没有匹配的频道</li>
						)}
						{!progress.channels &&
							progress.channelNames?.map((name, index) => (
								<li key={`${index}:${name}`}># {name}</li>
							))}
						{!progress.found && <li className="discovery-empty">尚未识别到频道</li>}
					</ul>
					<div className="discovery-actions">
						<button type="button" disabled={pending} onClick={() => void decide(true)}>
							继续识别
						</button>
						<button
							type="button"
							className="discovery-primary"
							disabled={pending}
							onClick={() => void decide(false)}
						>
							{(progress.channels ? selectedCount : progress.found)
								? "使用所选频道并继续"
								: "退出，返回设置"}
						</button>
					</div>
				</>
			) : (
				<button
					type="button"
					className="discovery-exit"
					disabled={pending}
					onClick={() => void decide()}
				>
					{pending ? "正在暂停…" : "退出识别"}
				</button>
			)}
			{error && (
				<p className="discovery-error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
