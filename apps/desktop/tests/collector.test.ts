import { EventEmitter } from "node:events";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fork: vi.fn() }));
vi.mock("electron", () => ({ utilityProcess: { fork: mocks.fork } }));
vi.mock("../src/main/discovery/runtime", () => ({ resolveEngineDirectory: () => "/engine" }));

import { finishUnreadChannels } from "../src/main/collector";
import type { Task } from "../src/shared/contracts";

class Worker extends EventEmitter {
	kill = vi.fn(() => true);
	postMessage = vi.fn();
}

beforeEach(() => mocks.fork.mockReset());

describe("Discord utility process lifecycle", () => {
	it("keeps progress alive, then kills the worker and ignores late messages after success", async () => {
		const worker = new Worker();
		mocks.fork.mockReturnValue(worker);
		const progress = vi.fn();
		const promise = finishUnreadChannels(
			{} as Task,
			[],
			new AbortController().signal,
			undefined,
			progress,
		);
		const channel = {
			channelId: "one",
			channelName: "news",
			index: 1,
			total: 1,
			status: "scanning",
		};
		worker.emit("message", { type: "progress", channel });
		expect(progress).toHaveBeenCalledWith(channel);
		expect(worker.kill).not.toHaveBeenCalled();
		worker.emit("message", { type: "result" });
		await promise;
		worker.emit("message", { type: "progress", channel });
		expect(progress).toHaveBeenCalledTimes(1);
		expect(worker.kill).toHaveBeenCalledTimes(1);
	});

	it("kills the worker on invalid responses and native errors", async () => {
		for (const message of [
			{ type: "unknown" },
			{ type: "error", message: "未找到 Discord 主窗口" },
		]) {
			const worker = new Worker();
			mocks.fork.mockReturnValue(worker);
			const promise = finishUnreadChannels({} as Task, [], new AbortController().signal);
			worker.emit("message", message);
			await expect(promise).rejects.toThrow(
				message.type === "error" ? "未找到 Discord 主窗口" : "无效响应",
			);
			expect(worker.kill).toHaveBeenCalledTimes(1);
		}
	});

	it("kills a cancelled worker once and removes the abort listener after settlement", async () => {
		const worker = new Worker();
		mocks.fork.mockReturnValue(worker);
		const controller = new AbortController();
		const promise = finishUnreadChannels({} as Task, [], controller.signal);
		controller.abort();
		await expect(promise).rejects.toThrow("采集已暂停");
		worker.emit("exit", 0);
		expect(worker.kill).toHaveBeenCalledTimes(1);
	});
});
