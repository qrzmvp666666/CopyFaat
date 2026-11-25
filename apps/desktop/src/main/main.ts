import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import { app, BrowserWindow, dialog, ipcMain, shell, systemPreferences } from "electron";

import type { AppState, TaskInput } from "../shared/contracts";
import { runCollector } from "./collector";
import { createEngine } from "./engine";
import { createStore } from "./store";

let workspace: BrowserWindow | undefined;
let engine: ReturnType<typeof createEngine> | undefined;
let store: Awaited<ReturnType<typeof createStore>> | undefined;

function isDev() {
	return process.env.COPYFAST_DEV === "1";
}
function rendererUrl(route = "") {
	return isDev()
		? `http://localhost:${process.env.COPYFAST_DEV_PORT ?? "5173"}/#${route || "/"}`
		: `file://${join(__dirname, "../renderer/index.html")}${route ? `#${route}` : ""}`;
}
function publicState(state: AppState) {
	return {
		...state,
		tasks: state.tasks.map((task) => {
			const legacy = task as typeof task & { delivery?: unknown; target?: unknown };
			const { delivery: _delivery, target: _target, ...safeTask } = legacy;
			return safeTask;
		}),
	};
}
function sendState(state: AppState) {
	const data = publicState(state);
	workspace?.webContents.send("state", data);
}

async function firstExistingPath(paths: string[]) {
	for (const path of paths) {
		try {
			await access(path);
			return path;
		} catch {
			// Continue through known install locations.
		}
	}
	return undefined;
}

async function desktopAppPath(target: "telegram" | "discord") {
	const home = homedir();
	if (process.platform === "darwin") {
		const appName = target === "telegram" ? "Telegram.app" : "Discord.app";
		return firstExistingPath([
			join("/Applications", appName),
			join(home, "Applications", appName),
		]);
	}
	if (process.platform === "win32") {
		const local = process.env.LOCALAPPDATA ?? "";
		const roaming = process.env.APPDATA ?? "";
		if (target === "telegram")
			return firstExistingPath([
				join(roaming, "Telegram Desktop", "Telegram.exe"),
				join(local, "Programs", "Telegram Desktop", "Telegram.exe"),
			]);
		const discordDir = join(local, "Discord");
		let versions: string[] = [];
		try {
			versions = (await readdir(discordDir)).filter((name) => name.startsWith("app-"));
		} catch {
			return undefined;
		}
		return firstExistingPath(
			versions
				.sort()
				.reverse()
				.map((version) => join(discordDir, version, "Discord.exe")),
		);
	}
	const candidates = target === "telegram" ? ["telegram-desktop", "Telegram"] : ["discord"];
	const searchPaths = (process.env.PATH ?? "").split(delimiter);
	return firstExistingPath(
		searchPaths.flatMap((directory) => candidates.map((name) => join(directory, name))),
	);
}

async function runtimeInfo() {
	const [telegram, discord] = await Promise.all([
		desktopAppPath("telegram"),
		desktopAppPath("discord"),
	]);
	return {
		platform: process.platform,
		version: app.getVersion(),
		permissions: {
			accessibility:
				process.platform !== "darwin" ||
				systemPreferences.isTrustedAccessibilityClient(false),
			screen: "not-required",
		},
		systemSupported: process.platform === "darwin" || process.platform === "win32",
		apps: { telegram: Boolean(telegram), discord: Boolean(discord) },
	};
}

const appIconPath = join(__dirname, "../assets/icon.png");

function createWindows() {
	workspace = new BrowserWindow({
		width: 1480,
		height: 830,
		minWidth: 1100,
		minHeight: 700,
		show: false,
		title: "CopyFast",
		icon: appIconPath,
		transparent: true,
		backgroundColor: "#141415",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		vibrancy: process.platform === "darwin" ? "hud" : undefined,
		backgroundMaterial: process.platform === "win32" ? "acrylic" : undefined,
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});
	void workspace.loadURL(rendererUrl("/"));
	workspace.once("ready-to-show", () => workspace?.show());
	workspace.on("closed", () => {
		workspace = undefined;
	});
}

function registerIpc() {
	ipcMain.handle("state", () => (store ? publicState(store.read()) : undefined));
	ipcMain.handle("runtime", runtimeInfo);
	ipcMain.handle("launch-desktop-app", async (_event, target: "telegram" | "discord") => {
		const path = await desktopAppPath(target);
		if (!path) return false;
		return !(await shell.openPath(path));
	});
	ipcMain.handle("request-accessibility-permission", async () => {
		if (process.platform !== "darwin") return true;
		const isTrusted = systemPreferences.isTrustedAccessibilityClient(true);
		if (!isTrusted)
			await shell.openExternal(
				"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
			);
		return isTrusted;
	});
	ipcMain.handle("save-task", async (_event, input: TaskInput, id?: string) =>
		engine!.saveTask(input, id),
	);
	ipcMain.handle("choose-collector", async () => {
		const result = await dialog.showOpenDialog(workspace!, {
			properties: ["openFile"],
			title: "选择本机采集程序",
		});
		return result.canceled ? null : (result.filePaths[0] ?? null);
	});
	ipcMain.handle("delete-task", async (_event, id: string) => engine!.deleteTask(id));
	ipcMain.handle("task-action", async (_event, id: string, action: "pause" | "resume" | "run") =>
		engine!.action(id, action),
	);
	ipcMain.handle("open-external", async (_event, target: string) => {
		const urls: Record<string, string> = {
			telegram: "https://desktop.telegram.org/",
			discord: "https://discord.com/download",
			support: "https://t.me/Michael_Qin",
		};
		if (target === "permissions" && process.platform === "darwin")
			return shell.openExternal(
				"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
			);
		if (urls[target]) return shell.openExternal(urls[target]);
	});
	ipcMain.handle("show-workspace", (_event, taskId?: string, tab?: string) => {
		workspace?.show();
		workspace?.focus();
		workspace?.webContents.send("navigate", { taskId, tab });
	});
	ipcMain.handle("window-action", (_event, action: "minimize" | "maximize" | "close") => {
		if (action === "minimize") workspace?.minimize();
		else if (action === "maximize") {
			if (workspace?.isMaximized()) workspace.unmaximize();
			else workspace?.maximize();
		} else workspace?.close();
	});
}

void app.whenReady().then(async () => {
	app.dock?.setIcon(appIconPath);
	store = await createStore(join(app.getPath("userData"), "copyfast-state.json"), sendState);
	engine = createEngine(store, {
		collect: runCollector,
	});
	await engine.recover();
	engine.start();
	registerIpc();
	createWindows();
	app.on("activate", () => workspace?.show());
});
app.on("before-quit", () => {
	void engine?.stop();
});
