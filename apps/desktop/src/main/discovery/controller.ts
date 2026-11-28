import { join } from "node:path";

import { BrowserWindow, globalShortcut, ipcMain, screen, utilityProcess } from "electron";

import type {
	DiscoveryOverlayState,
	DiscoveryProgress,
	DiscoveryRect,
	DiscoveryResult,
} from "../../shared/contracts";
import { resolveEngineDirectory } from "./runtime";

export function registerDiscovery(
	workspace: () => BrowserWindow | undefined,
	rendererUrl: (route: string) => string,
	launchDiscord: () => Promise<boolean>,
) {
	let overlay: BrowserWindow | undefined;
	let worker: Electron.UtilityProcess | undefined;
	let state: DiscoveryOverlayState | null = null;
	let finish: ((result?: DiscoveryResult | null, error?: string) => void) | undefined;
	let launching = false;
	let exitRequested = false;
	let latestResult: DiscoveryResult | undefined;
	let completedResult: DiscoveryResult | undefined;
	let confirmationResult: DiscoveryResult | undefined;
	let scanningProgress: DiscoveryProgress | undefined;
	let confirmingExit = false;
	let excludedChannelIds = new Set<string>();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	function armTimeout() {
		clearTimeout(timeout);
		timeout = setTimeout(
			() => finish?.(null, "扫描超时，请重新开始选择。配置已保留。"),
			15 * 60_000,
		);
	}

	function resizeOverlay(confirming: boolean) {
		if (!overlay || !state) return;
		const { workArea } = screen.getDisplayMatching(state.bounds);
		const width = Math.min(confirming ? 460 : 430, workArea.width);
		const height = Math.min(confirming ? 480 : 96, workArea.height);
		overlay.setBounds({
			x: workArea.x + workArea.width - width,
			y: workArea.y + workArea.height - height,
			width,
			height,
		});
		overlay.setFocusable(confirming);
		if (confirming) {
			overlay.show();
			overlay.focus();
		}
	}
	function showExitConfirmation() {
		if (!finish || !exitRequested || confirmingExit) return;
		confirmingExit = true;
		clearTimeout(timeout);
		scanningProgress = state?.progress;
		const result = (confirmationResult = completedResult ?? latestResult);
		progress({
			phase: "paused",
			found: result?.scope.channels.length ?? 0,
			serverName: result?.scope.server.name,
			channelNames: result?.scope.channels.map((channel) => channel.name) ?? [],
			channels: result?.scope.channels ?? [],
			message: result?.scope.channels.length
				? "勾选需要保留的频道，取消勾选可排除误识别或不需要的频道。"
				: "尚未识别到频道。退出将返回来源设置，或继续等待识别。",
		});
		resizeOverlay(true);
	}
	function requestExit() {
		if (!finish || exitRequested) return;
		exitRequested = true;
		worker?.postMessage({ type: "pause" });
	}
	function selectedResult(result?: DiscoveryResult): DiscoveryResult | null {
		if (!result) return null;
		const channels = result.scope.channels.filter(
			(channel) => !excludedChannelIds.has(channel.id),
		);
		if (!channels.length) return null;
		if (channels.length === result.scope.channels.length) return result;
		return {
			...result,
			scope: { ...result.scope, channels },
			message: `${result.message} 已保留 ${channels.length} 个所选频道。`,
		};
	}
	function resolveExit(continueScanning: boolean, selectedChannelIds?: unknown) {
		if (!finish || !confirmingExit) return;
		const result = confirmationResult;
		if (selectedChannelIds !== undefined) {
			if (
				!Array.isArray(selectedChannelIds) ||
				selectedChannelIds.length > 500 ||
				selectedChannelIds.some(
					(id) =>
						typeof id !== "string" ||
						!result?.scope.channels.some((channel) => channel.id === id),
				)
			)
				throw new Error("频道选择无效，请重试。");
			const selected = new Set(selectedChannelIds);
			excludedChannelIds = new Set(
				result?.scope.channels
					.filter((channel) => !selected.has(channel.id))
					.map((channel) => channel.id),
			);
		}
		if (!continueScanning) {
			finish(selectedResult(result));
			return;
		}
		exitRequested = false;
		confirmingExit = false;
		resizeOverlay(false);
		armTimeout();
		if (completedResult) {
			finish(selectedResult(completedResult));
			return;
		}
		progress(
			scanningProgress ?? {
				phase: "scanning",
				found: latestResult?.scope.channels.length ?? 0,
				message: "继续识别 Discord 频道…",
			},
		);
		worker?.postMessage({ type: "resume" });
	}

	function progress(value: DiscoveryProgress) {
		if (state) state.progress = value;
		overlay?.webContents.send("discovery-progress", value);
		workspace()?.webContents.send("discovery-progress", value);
	}
	function cancel() {
		finish?.(null);
	}
	function assertWorkspace(event: Electron.IpcMainInvokeEvent) {
		if (event.sender !== workspace()?.webContents) throw new Error("无效的桌面发现请求。");
	}
	ipcMain.handle("discover-discord-channels", async (event) => {
		assertWorkspace(event);
		if (finish || launching) throw new Error("已有识别任务正在运行。");
		exitRequested = false;
		confirmingExit = false;
		latestResult = undefined;
		completedResult = undefined;
		confirmationResult = undefined;
		excludedChannelIds = new Set();
		scanningProgress = undefined;
		launching = true;
		let launched = false;
		try {
			launched = await launchDiscord();
		} finally {
			launching = false;
		}
		if (!launched) throw new Error("无法打开 Discord，请先安装并登录桌面端。");
		return new Promise<DiscoveryResult | null>((resolve, reject) => {
			armTimeout();
			const closed = () => cancel();
			finish = (result = null, error) => {
				finish = undefined;
				clearTimeout(timeout);
				globalShortcut.unregister("Escape");
				workspace()?.removeListener("closed", closed);
				worker?.kill();
				worker = undefined;
				overlay?.destroy();
				overlay = undefined;
				state = null;
				workspace()?.show();
				workspace()?.focus();
				if (error) reject(new Error(error));
				else resolve(result);
			};
			try {
				if (!globalShortcut.register("Escape", requestExit))
					throw new Error("无法注册 Esc 退出快捷键，请关闭占用该快捷键的程序后重试。");
				workspace()?.once("closed", closed);
				workspace()?.hide();
				const directory = resolveEngineDirectory({
					resourcesPath: process.resourcesPath,
					mainDirectory: __dirname,
					platform: process.platform,
					arch: process.arch,
				});
				const activeWorker = (worker = utilityProcess.fork(
					join(__dirname, "discovery-worker.cjs"),
					[directory],
					{ serviceName: "CopyFast Engine", stdio: "ignore" },
				));
				let startScan = () => activeWorker.postMessage({ type: "scan" });
				const handleMessage = (message: {
					type: string;
					bounds?: DiscoveryRect;
					progress?: DiscoveryProgress;
					result?: DiscoveryResult;
					message?: string;
				}) => {
					if (!finish || worker !== activeWorker) return;
					if (message.type === "error")
						finish(null, message.message ?? "识别失败，请重试。");
					else if (message.type === "snapshot" && message.result)
						latestResult = message.result;
					else if (message.type === "paused") showExitConfirmation();
					else if (message.type === "result" && message.result) {
						if (exitRequested) {
							completedResult = message.result;
							showExitConfirmation();
						} else finish(selectedResult(message.result));
					} else if (message.type === "progress" && message.progress && !confirmingExit)
						progress(message.progress);
					else if (message.type === "ready" && message.bounds) {
						const overlayBounds =
							process.platform === "win32"
								? screen.screenToDipRect(null, message.bounds)
								: message.bounds;
						const bounds = Object.fromEntries(
							Object.entries(overlayBounds).map(([key, value]) => [
								key,
								Math.round(value),
							]),
						) as unknown as DiscoveryRect;
						state = {
							bounds,
							progress: {
								phase: "preparing",
								found: 0,
								message: "正在自动定位 Discord 频道侧栏…",
							},
						};
						const { workArea } = screen.getDisplayMatching(bounds);
						overlay = new BrowserWindow({
							x: workArea.x + Math.max(0, workArea.width - 440),
							y: workArea.y + Math.max(0, workArea.height - 106),
							width: 430,
							height: 96,
							focusable: false,
							frame: false,
							transparent: true,
							resizable: false,
							movable: false,
							alwaysOnTop: true,
							skipTaskbar: true,
							hasShadow: false,
							show: false,
							webPreferences: {
								preload: join(__dirname, "preload.cjs"),
								contextIsolation: true,
								nodeIntegration: false,
								sandbox: true,
							},
						});
						const activeOverlay = overlay;
						overlay.on("closed", () => {
							if (overlay === activeOverlay) requestExit();
						});
						overlay.setAlwaysOnTop(true, "screen-saver");
						overlay.setIgnoreMouseEvents(false);
						overlay.once("ready-to-show", () => {
							if (!finish || overlay !== activeOverlay || worker !== activeWorker)
								return;
							overlay.showInactive();
							startScan();
						});
						void overlay
							.loadURL(rendererUrl("discovery-overlay"))
							.catch(() => finish?.(null, "无法打开选择页面，请重试。"));
					}
				};
				activeWorker.on("error", () => {
					if (worker === activeWorker)
						finish?.(null, "桌面引擎无法启动，请重新安装 CopyFast。");
				});
				activeWorker.on("exit", () => {
					if (finish && worker === activeWorker)
						finish(null, "桌面引擎已停止，请重新开始选择。");
				});
				activeWorker.on("message", handleMessage);
				activeWorker.postMessage({ type: "prepare" });
			} catch (error) {
				finish?.(null, error instanceof Error ? error.message : "无法启动频道识别。");
			}
		});
	});
	ipcMain.handle("cancel-discovery", (event) => {
		if (event.sender === overlay?.webContents || event.sender === workspace()?.webContents)
			requestExit();
	});
	ipcMain.handle(
		"resolve-discovery-exit",
		(event, continueScanning: boolean, selectedChannelIds?: unknown) => {
			if (event.sender === overlay?.webContents && typeof continueScanning === "boolean")
				resolveExit(continueScanning, selectedChannelIds);
		},
	);
	ipcMain.handle("discovery-overlay-state", (event) =>
		event.sender === overlay?.webContents ? state : null,
	);

	return { cancel };
}
