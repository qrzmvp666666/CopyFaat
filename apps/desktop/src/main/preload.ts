import { contextBridge, ipcRenderer } from "electron";

import type { DesktopApi } from "../shared/contracts";

const api: DesktopApi = {
	discoverDiscordChannels: () => ipcRenderer.invoke("discover-discord-channels"),
	cancelDiscovery: () => ipcRenderer.invoke("cancel-discovery"),
	resolveDiscoveryExit: (continueScanning) =>
		ipcRenderer.invoke("resolve-discovery-exit", continueScanning),
	discoveryOverlayState: () => ipcRenderer.invoke("discovery-overlay-state"),
	onDiscoveryProgress: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			progress: Parameters<typeof callback>[0],
		) => callback(progress);
		ipcRenderer.on("discovery-progress", listener);
		return () => ipcRenderer.removeListener("discovery-progress", listener);
	},
	onTaskActivity: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			activity: Parameters<typeof callback>[0],
		) => callback(activity);
		ipcRenderer.on("task-activity", listener);
		return () => ipcRenderer.removeListener("task-activity", listener);
	},
	taskActivityState: () => ipcRenderer.invoke("task-activity-state"),
	state: () => ipcRenderer.invoke("state"),
	runtime: () => ipcRenderer.invoke("runtime"),
	saveTask: (input, id) => ipcRenderer.invoke("save-task", input, id),
	taskAction: (id, action) => ipcRenderer.invoke("task-action", id, action),
	deleteTask: (id) => ipcRenderer.invoke("delete-task", id),
	launchDesktopApp: (target) => ipcRenderer.invoke("launch-desktop-app", target),
	requestAccessibilityPermission: () => ipcRenderer.invoke("request-accessibility-permission"),
	openExternal: (target) => ipcRenderer.invoke("open-external", target),
	showWorkspace: (taskId, tab) => ipcRenderer.invoke("show-workspace", taskId, tab),
	windowAction: (action) => ipcRenderer.invoke("window-action", action),
	onState: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			state: Parameters<typeof callback>[0],
		) => callback(state);
		ipcRenderer.on("state", listener);
		return () => ipcRenderer.removeListener("state", listener);
	},
	onNavigate: (callback) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			target: Parameters<typeof callback>[0],
		) => callback(target);
		ipcRenderer.on("navigate", listener);
		return () => ipcRenderer.removeListener("navigate", listener);
	},
};
contextBridge.exposeInMainWorld("copyfast", api);
