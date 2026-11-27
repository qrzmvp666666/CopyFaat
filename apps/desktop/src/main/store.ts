import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { initialState, type AppState } from "../shared/contracts";

export interface StateStore {
	read(): AppState;
	update(change: (draft: AppState) => void): Promise<void>;
}
export async function createStore(
	path: string,
	onChange: (state: AppState) => void = () => {},
): Promise<StateStore> {
	let state: AppState;
	try {
		state = JSON.parse(await readFile(path, "utf8"));
		if (
			state.version !== 1 ||
			!Array.isArray(state.tasks) ||
			!Array.isArray(state.messages) ||
			!Array.isArray(state.logs)
		)
			throw new Error("不支持的桌面数据格式");

		for (const task of state.tasks) {
			if (!task.receiver) continue;
			const legacy = task.receiver as typeof task.receiver & {
				webhookUrl?: string;
				server?: unknown;
			};
			for (const channel of legacy.channels) {
				if (!channel.webhookUrl && legacy.webhookUrl)
					channel.webhookUrl = legacy.webhookUrl;
			}
			delete legacy.webhookUrl;
			delete legacy.server;
		}
		for (const message of state.messages) {
			message.mediaLabels ??= [];
			if (
				![
					"filtered",
					"collected",
					"pending",
					"sending",
					"synced",
					"failed",
					"uncertain",
				].includes(message.status)
			)
				message.status = "collected";
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		state = initialState();
	}
	let tail = Promise.resolve();
	return {
		read: () => structuredClone(state),
		update(change) {
			const work = tail.then(async () => {
				const draft = structuredClone(state);
				change(draft);
				draft.logs = draft.logs.slice(-5000);
				await mkdir(dirname(path), { recursive: true, mode: 0o700 });
				await writeFile(`${path}.tmp`, JSON.stringify(draft), { mode: 0o600 });
				await rename(`${path}.tmp`, path);
				state = draft;
				onChange(structuredClone(state));
			});
			tail = work.catch(() => {});
			return work;
		},
	};
}
