import { describe, expect, it } from "vitest";

import { getTaskPollingState } from "../src/renderer/ui/task-polling";
import type { Task } from "../src/shared/contracts";

const now = new Date(2026, 10, 28, 15, 50, 0).getTime();
function task(seconds: number, status: Task["status"] = "running"): Task {
	return { status, nextRunAt: new Date(now + seconds * 1000).toISOString() } as Task;
}

describe("task polling schedule", () => {
	it("counts down from the persisted deadline and does not go negative", () => {
		expect(getTaskPollingState(task(45), false, now)?.countdown).toBe("00:45 后轮询");
		expect(getTaskPollingState(task(45), false, now + 2000)?.countdown).toBe("00:43 后轮询");
		expect(getTaskPollingState(task(45), false, now + 46_000)?.countdown).toBe("等待开始轮询");
		expect(getTaskPollingState(task(45), false, now)?.nextPoll).toBe("下次轮询 15:50:45");
	});
	it("stops presenting stale deadlines while collecting, paused or needing attention", () => {
		expect(getTaskPollingState(task(-30), true, now)).toEqual({
			countdown: "本轮采集中",
			nextPoll: "本轮结束后安排下一次轮询",
		});
		expect(getTaskPollingState(task(45, "paused"), false, now)).toBeNull();
		expect(getTaskPollingState(task(45, "attention"), false, now)).toBeNull();
	});
	it("uses the retry deadline and displays hours and dates for long waits", () => {
		expect(getTaskPollingState({ ...task(30), retryAttempt: 1 }, false, now)).toEqual({
			countdown: "00:30 后重试",
			nextPoll: "下次重试 15:50:30",
		});
		expect(getTaskPollingState(task(86401), false, now)).toEqual({
			countdown: "24:00:01 后轮询",
			nextPoll: "下次轮询 2026/11/29 15:50:01",
		});
	});
	it("handles invalid persisted deadlines without displaying NaN", () => {
		expect(getTaskPollingState({ ...task(0), nextRunAt: "invalid" }, false, now)).toEqual({
			countdown: "等待调度",
			nextPoll: "下一次轮询时间待确认",
		});
	});
});
