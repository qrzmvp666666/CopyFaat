import {
	CheckCircle2,
	CircleAlert,
	ExternalLink,
	LoaderCircle,
	MonitorCog,
	RefreshCw,
	ShieldCheck,
} from "lucide-react";

import type { RuntimeInfo } from "../../shared/contracts";

interface ConnectionsProps {
	runtimeInfo?: RuntimeInfo;
	isChecking: boolean;
	actionMessage?: string;
	setupDismissed: boolean;
	onReturnToWorkspace: () => void;
	onCheck: () => void;
	onLaunchApp: (target: "telegram" | "discord") => void;
	onRequestPermission: () => void;
	onDismissSetup: () => void;
}

export function Connections({
	runtimeInfo,
	isChecking,
	actionMessage,
	setupDismissed,
	onReturnToWorkspace,
	onCheck,
	onLaunchApp,
	onRequestPermission,
	onDismissSetup,
}: ConnectionsProps) {
	const isMac = runtimeInfo?.platform === "darwin";
	const permissionGranted = runtimeInfo?.permissions.accessibility ?? false;
	const installedCount = Number(Boolean(runtimeInfo?.apps.discord));
	const readiness = !runtimeInfo
		? "尚未检测"
		: !runtimeInfo.systemSupported
			? "当前系统暂不支持"
			: isMac && !permissionGranted
				? "需要授权"
				: installedCount === 0
					? "未发现桌面应用"
					: "本机条件符合";

	return (
		<section className="connections-view">
			<header className="connections-heading">
				<div>
					<div className="eyebrow">工作区 / 连接与权限</div>
					<h1>连接与权限</h1>
					<p>连接桌面应用并完成必要授权，即可开始本机采集。采集内容仅保存在此设备。</p>
				</div>
				<button className="secondary connections-back" onClick={onReturnToWorkspace}>
					返回工作台
				</button>
			</header>

			{!setupDismissed && (
				<div className="setup-progress">
					<div className="setup-progress-icon">
						<MonitorCog size={17} />
					</div>
					<div className="setup-progress-copy">
						<strong>首次设置</strong>
						<span>先检测本机环境，再连接桌面应用并完成权限设置。</span>
					</div>
					<div className="setup-progress-steps" aria-label="设置步骤">
						<span className="current">
							<i>1</i> 检测环境
						</span>
						<span>
							<i>2</i> 连接应用
						</span>
						<span>
							<i>3</i> 完成授权
						</span>
					</div>
					<button className="text-action" onClick={onDismissSetup}>
						稍后设置
					</button>
				</div>
			)}

			<div className="connection-runtime">
				<div className="connection-runtime-icon">
					<MonitorCog size={19} />
				</div>
				<div className="connection-runtime-copy">
					<div className="connection-title-row">
						<h2>本机环境检查</h2>
						<span
							className={`connection-status ${runtimeInfo && runtimeInfo.systemSupported ? "status-ready" : ""}`}
						>
							{isChecking ? (
								<LoaderCircle className="spin" size={13} />
							) : runtimeInfo?.systemSupported ? (
								<CheckCircle2 size={13} />
							) : (
								<CircleAlert size={13} />
							)}
							{isChecking ? "正在检测" : readiness}
						</span>
					</div>
					<p>检查系统兼容性、桌面应用安装情况与必要授权。此检测只读取本机状态。</p>
					{runtimeInfo && (
						<small>
							当前系统：{platformName(runtimeInfo.platform)} · CopyFast{" "}
							{runtimeInfo.version}
						</small>
					)}
					{actionMessage && <small className="connection-error">{actionMessage}</small>}
				</div>
				<button
					className="secondary connection-action"
					onClick={onCheck}
					disabled={isChecking}
				>
					<RefreshCw size={14} className={isChecking ? "spin" : ""} />
					{runtimeInfo ? "重新检测" : "检测本机环境"}
				</button>
			</div>

			<div className="connection-columns">
				<section className="connection-section">
					<div className="section-heading">
						<div>
							<h2>桌面应用</h2>
							<p>使用你已登录的桌面应用作为采集来源。</p>
						</div>
					</div>
					<div className="desktop-app-list">
						<AppRow
							name="Discord Desktop"
							short="DC"
							installed={runtimeInfo?.apps.discord}
							onClick={() =>
								runtimeInfo?.apps.discord
									? onLaunchApp("discord")
									: runtimeInfo
										? void window.copyfast.openExternal("discord")
										: onCheck()
							}
						/>
					</div>
				</section>

				<section className="connection-section permissions-section">
					<div className="section-heading">
						<div>
							<h2>系统权限</h2>
							<p>
								{isMac
									? "允许 CopyFast 读取和操作桌面应用。"
									: "权限状态由当前系统管理，检测结果会显示在这里。"}
							</p>
						</div>
					</div>
					<div className="permission-row">
						<div className="permission-icon">
							<ShieldCheck size={16} />
						</div>
						<div className="permission-copy">
							<strong>桌面操作权限</strong>
							<span>
								{runtimeInfo
									? isMac
										? permissionGranted
											? "已授权"
											: "待授权"
										: "无需单独授权"
									: "等待检测"}
							</span>
						</div>
						{isMac && (
							<button
								className="secondary permission-action"
								onClick={onRequestPermission}
								disabled={permissionGranted}
							>
								<ExternalLink size={13} />
								{permissionGranted ? "已授权" : "打开系统设置"}
							</button>
						)}
					</div>
				</section>
			</div>
		</section>
	);
}

function AppRow({
	name,
	short,
	installed,
	onClick,
}: {
	name: string;
	short: string;
	installed?: boolean;
	onClick: () => void;
}) {
	return (
		<div className="desktop-app-row">
			<i className={`platform ${short === "TG" ? "telegram" : "discord"}`}>{short}</i>
			<div className="desktop-app-copy">
				<strong>{name}</strong>
				<span>
					{installed === undefined
						? "尚未检测"
						: installed
							? "已安装，可启动"
							: "未检测到安装"}
				</span>
			</div>
			<button className="secondary app-action" onClick={onClick}>
				{installed === undefined ? "检测状态" : installed ? "启动应用" : "获取应用"}
				{installed === false && <ExternalLink size={12} />}
			</button>
		</div>
	);
}

function platformName(platform: string) {
	if (platform === "darwin") return "macOS";
	if (platform === "win32") return "Windows";
	if (platform === "linux") return "Linux";
	return platform;
}
