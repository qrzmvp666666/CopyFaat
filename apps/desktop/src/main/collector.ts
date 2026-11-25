import { spawn } from "node:child_process";

import { collectorResponseSchema, type CollectorResponse, type Task } from "../shared/contracts";

export function runCollector(task: Task, signal: AbortSignal): Promise<CollectorResponse> {
	return new Promise((resolve, reject) => {
		const child = spawn(task.collector.executable, task.collector.args, {
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
			failure = new Error("采集超时（60 秒），任务已停止");
			child.kill();
		}, 60_000);
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
			if (Buffer.byteLength(stdout) > 5_000_000) {
				failure = new Error("采集输出超过 5 MB，请缩小批次");
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
