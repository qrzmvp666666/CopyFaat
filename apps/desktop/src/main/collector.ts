import { spawn } from "node:child_process";
import { join } from "node:path";

import { utilityProcess } from "electron";

import { collectorResponseSchema, type CollectorResponse, type Task } from "../shared/contracts";
import type { DiscoveryRect } from "../shared/contracts";
import { resolveEngineDirectory } from "./discovery/runtime";
import { parseDesktopWorkerResponse } from "./worker-protocol";

type DesktopWorkerOperation = "collect" | "finish";

function runDesktopWorker(
	task: Task,
	operation: DesktopWorkerOperation,
	signal: AbortSignal,
	channelIds: string[] = [],
	onWindowBounds?: (bounds: DiscoveryRect) => void,
): Promise<unknown> {
	const directory = resolveEngineDirectory({
		resourcesPath: process.resourcesPath,
		mainDirectory: __dirname,
		platform: process.platform,
		arch: process.arch,
	});
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(new Error("采集已取消"));
		const worker = utilityProcess.fork(join(__dirname, "collection-worker.cjs"), [directory], {
			serviceName: "CopyFast Collection",
			stdio: "ignore",
		});
		let settled = false;
		const timeout = setTimeout(() => {
			worker.kill();
			finish(new Error("本轮 Discord 采集超过 15 分钟，已停止；下轮可重试。"));
		}, 15 * 60_000);
		const onAbort = () => {
			worker.kill();
			finish(new Error("采集已暂停；未确认的发送结果会保留为待核对状态。"));
		};
		function finish(error?: Error, result?: unknown) {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			signal.removeEventListener("abort", onAbort);
			if (error) reject(error);
			else resolve(result);
		}
		signal.addEventListener("abort", onAbort, { once: true });
		worker.on("message", (value) => {
			const message = parseDesktopWorkerResponse(value);
			if (!message) {
				finish(new Error("Discord 操作进程返回了无效响应。"));
				return;
			}
			if (message.type === "result") finish(undefined, message.result);
			else if (message.type === "ready" && message.bounds) onWindowBounds?.(message.bounds);
			else finish(new Error(message.message ?? "Discord 操作失败。"));
		});
		worker.on("error", (error) => finish(new Error(error)));
		worker.on("exit", (code) => {
			if (!settled) finish(new Error(`Discord 操作进程已退出（${code}）。`));
		});
		worker.postMessage({ task, operation, channelIds });
	});
}

export async function runCollector(
	task: Task,
	signal: AbortSignal,
	onWindowBounds?: (bounds: DiscoveryRect) => void,
): Promise<CollectorResponse> {
	if (task.collector) return runLegacyCollector(task, signal);
	const result = await runDesktopWorker(task, "collect", signal, [], onWindowBounds);
	return collectorResponseSchema.parse(result);
}

function runLegacyCollector(task: Task, signal: AbortSignal): Promise<CollectorResponse> {
	return new Promise((resolve, reject) => {
		const child = spawn(task.collector!.executable, task.collector!.args, {
			shell: false,
			windowsHide: true,
			signal,
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				PATH: process.env.PATH,
				HOME: process.env.HOME,
				USERPROFILE: process.env.USERPROFILE,
				SYSTEMROOT: process.env.SYSTEMROOT,
				LANG: "en_US.UTF-8",
			},
		});
		let stdout = "";
		let stderr = "";
		let failure: Error | undefined;
		const timeout = setTimeout(() => {
			failure = new Error("采集脚本运行超过 60 秒，已停止。");
			child.kill();
		}, 60_000);
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
			if (Buffer.byteLength(stdout) > 5_000_000) {
				failure = new Error("采集脚本输出超过 5 MB，请缩小批次。");
				child.kill();
			}
		});
		child.stderr.on("data", (chunk) => {
			stderr = (stderr + chunk.toString()).slice(-2000);
		});
		child.stdin.on("error", () => {});
		child.once("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once("close", (code) => {
			clearTimeout(timeout);
			if (failure) return reject(failure);
			if (signal.aborted) return reject(new Error("采集已取消"));
			if (code !== 0) return reject(new Error(stderr.trim() || `采集脚本退出码 ${code}`));
			try {
				resolve(collectorResponseSchema.parse(JSON.parse(stdout)));
			} catch {
				reject(new Error("采集脚本未返回有效的 CopyFast v1 JSON 数据"));
			}
		});
		child.stdin.end(
			JSON.stringify({
				version: 1,
				source: task.source,
				cursor: task.cursor,
				since: task.rules.startAt,
				limit: 100,
			}),
		);
	});
}

export async function finishUnreadChannels(
	task: Task,
	channelIds: string[],
	signal: AbortSignal,
	onWindowBounds?: (bounds: DiscoveryRect) => void,
): Promise<void> {
	await runDesktopWorker(task, "finish", signal, channelIds, onWindowBounds);
}
