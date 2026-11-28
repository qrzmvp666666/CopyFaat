import { join } from "node:path";

import { BrowserWindow, screen } from "electron";

import type {
	DiscoveryRect,
	TaskActivityState,
	Task,
	TaskChannelProgress,
} from "../shared/contracts";
import { relativeChannelHighlight } from "./task-activity-layout";

export function createTaskActivityOverlay(rendererUrl: (route: string) => string) {
	let overlay: BrowserWindow | undefined;
	let state: TaskActivityState | null = null;
	const activeTasks = new Map<string, TaskActivityState>();

	function position(activity: TaskActivityState) {
		if (!overlay) return;
		const toDip = (bounds: DiscoveryRect) =>
			process.platform === "win32" ? screen.screenToDipRect(null, bounds) : bounds;
		const windowBounds = activity.windowBounds ? toDip(activity.windowBounds) : undefined;
		const { workArea } = windowBounds
			? screen.getDisplayMatching(windowBounds)
			: screen.getPrimaryDisplay();
		overlay.setBounds(workArea);
		activity.highlightBounds = relativeChannelHighlight(
			activity.channel?.bounds ? toDip(activity.channel.bounds) : undefined,
			workArea,
			windowBounds,
		);
	}

	function ensureWindow() {
		if (overlay && !overlay.isDestroyed()) return;
		overlay = new BrowserWindow({
			width: 380,
			height: 82,
			show: false,
			focusable: false,
			frame: false,
			transparent: true,
			resizable: false,
			movable: false,
			alwaysOnTop: true,
			skipTaskbar: true,
			hasShadow: false,
			webPreferences: {
				preload: join(__dirname, "preload.cjs"),
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
			},
		});
		overlay.setAlwaysOnTop(true, "screen-saver");
		overlay.setIgnoreMouseEvents(true);
		overlay.on("closed", () => {
			overlay = undefined;
		});
		void overlay.loadURL(rendererUrl("task-activity-overlay"));
	}

	function update(
		task: Task,
		phase: TaskActivityState["phase"] | "idle",
		bounds?: DiscoveryRect,
		channel?: TaskChannelProgress,
	) {
		if (phase === "idle") {
			activeTasks.delete(task.id);
		} else {
			activeTasks.set(task.id, {
				taskName: task.name,
				phase,
				channel,
				windowBounds: bounds ?? activeTasks.get(task.id)?.windowBounds,
			});
		}
		state = [...activeTasks.values()].at(-1) ?? null;
		if (!state) {
			overlay?.webContents.send("task-activity", null);
			overlay?.hide();
			return;
		}
		ensureWindow();
		position(state);
		overlay?.webContents.send("task-activity", state);
		if (overlay && !overlay.isVisible()) overlay.showInactive();
	}

	return {
		update,
		state: () => state,
		webContents: () => overlay?.webContents,
		close() {
			overlay?.destroy();
			overlay = undefined;
			state = null;
			activeTasks.clear();
		},
	};
}
