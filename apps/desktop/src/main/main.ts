import { join } from "node:path";

import { app, BrowserWindow, ipcMain, shell, systemPreferences } from "electron";

import type { AppState, TaskInput } from "../shared/contracts";
import { runCollector } from "./collector";
import { deliverMessage } from "./delivery";
import { createEngine } from "./engine";
import { createSecretStore } from "./secret-store";
import { createStore } from "./store";

let workspace: BrowserWindow | undefined;
let island: BrowserWindow | undefined;
let engine: ReturnType<typeof createEngine> | undefined;
let store: Awaited<ReturnType<typeof createStore>> | undefined;
let secrets: Awaited<ReturnType<typeof createSecretStore>> | undefined;

function isDev() {
	return process.env.COPYFAST_DEV === "1";
}
function rendererUrl(route = "") {
	return isDev()
		? `http://localhost:5173/#${route || "/"}`
		: `file://${join(__dirname, "../renderer/index.html")}${route ? `#${route}` : ""}`;
}
function publicState(state: AppState) {
	return {
		...state,
		tasks: state.tasks.map((task) => ({
			...task,
			delivery: {
				kind: task.delivery.kind,
				chatId: task.delivery.chatId,
				endpointConfigured: Boolean(task.delivery.endpoint),
				secretConfigured: Boolean(task.delivery.secretId),
			},
		})),
	};
}
function sendState(state: AppState) {
	const data = publicState(state);
	workspace?.webContents.send("state", data);
	island?.webContents.send("state", data);
}

function createWindows() {
	workspace = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 1100,
		minHeight: 700,
		show: false,
		title: "CopyFast",
		backgroundColor: "#111315",
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
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
	island = new BrowserWindow({
		width: 520,
		height: 88,
		minWidth: 420,
		maxWidth: 760,
		minHeight: 74,
		maxHeight: 720,
		transparent: true,
		frame: false,
		resizable: false,
		alwaysOnTop: true,
		skipTaskbar: true,
		show: false,
		vibrancy: process.platform === "darwin" ? "under-window" : undefined,
		backgroundMaterial: process.platform === "win32" ? "acrylic" : undefined,
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});
	void island.loadURL(rendererUrl("/island"));
	island.once("ready-to-show", () => island?.showInactive());
	island.on("closed", () => {
		island = undefined;
	});
}

function registerIpc() {
	ipcMain.handle("state", () => store?.read());
	ipcMain.handle("runtime", () => ({
		platform: process.platform,
		version: app.getVersion(),
		permissions: {
			accessibility:
				process.platform !== "darwin" ||
				systemPreferences.isTrustedAccessibilityClient(false),
			screen: "unknown",
		},
	}));
	ipcMain.handle("save-task", async (_event, input: TaskInput, id?: string) =>
		engine!.saveTask(input, id),
	);
	ipcMain.handle("save-secret", async (_event, id: string, value: string) =>
		secrets!.set(id, value),
	);
	ipcMain.handle("task-action", async (_event, id: string, action: "pause" | "resume" | "run") =>
		engine!.action(id, action),
	);
	ipcMain.handle("open-external", async (_event, target: string) => {
		const urls: Record<string, string> = {
			telegram: "https://desktop.telegram.org/",
			discord: "https://discord.com/app",
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
	ipcMain.handle("set-island", (_event, expanded: boolean) =>
		island?.setSize(520, expanded ? 720 : 88),
	);
	ipcMain.handle("window-action", (_event, action: "minimize" | "maximize" | "close") => {
		if (action === "minimize") workspace?.minimize();
		else if (action === "maximize") {
			if (workspace?.isMaximized()) workspace.unmaximize();
			else workspace?.maximize();
		} else workspace?.close();
	});
}

void app.whenReady().then(async () => {
	store = await createStore(join(app.getPath("userData"), "copyfast-state.json"), sendState);
	secrets = await createSecretStore(join(app.getPath("userData"), "copyfast-secrets.json"));
	engine = createEngine(store, {
		collect: runCollector,
		deliver: (task, message, signal) => {
			const secret = secrets?.get(task.delivery.secretId);
			if (!secret) return Promise.resolve({ state: "failed", error: "同步密钥尚未配置" });
			return deliverMessage(task, message, secret, signal);
		},
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
