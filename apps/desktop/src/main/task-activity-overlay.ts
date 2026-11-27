import { join } from "node:path";

import { BrowserWindow, screen } from "electron";

import type { DiscoveryRect, TaskActivityState, Task } from "../shared/contracts";

export function createTaskActivityOverlay(rendererUrl: (route: string) => string) {
	let overlay: BrowserWindow | undefined;
	let state: TaskActivityState | null = null;
	const activeTasks = new Map<string, TaskActivityState>();

	function position(bounds?: DiscoveryRect) {
		if (!overlay) return;
		const dipBounds =
			bounds && process.platform === "win32" ? screen.screenToDipRect(null, bounds) : bounds;
		const { workArea } = dipBounds
			? screen.getDisplayMatching(dipBounds)
			: screen.getPrimaryDisplay();
		const width = Math.min(380, workArea.width);
		const height = Math.min(82, workArea.height);
		overlay.setBounds({
			x: workArea.x + workArea.width - width - 20,
			y: workArea.y + workArea.height - height - 20,
			width,
			height,
		});
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
	) {
		if (phase === "idle") {
			activeTasks.delete(task.id);
		} else {
			activeTasks.set(task.id, {
				taskName: task.name,
				phase,
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
		position(state.windowBounds);
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
