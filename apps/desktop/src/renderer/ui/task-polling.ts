import type { Task } from "../../shared/contracts";

export function getTaskPollingState(task: Task, isCollecting: boolean, now: number) {
	if (task.status !== "running") return null;
	if (isCollecting) return { countdown: "本轮采集中", nextPoll: "本轮结束后安排下一次轮询" };
	const nextRunAt = Date.parse(task.nextRunAt);
	if (!Number.isFinite(nextRunAt))
		return { countdown: "等待调度", nextPoll: "下一次轮询时间待确认" };
	const remainingSeconds = Math.max(0, Math.ceil((nextRunAt - now) / 1000));
	const hours = Math.floor(remainingSeconds / 3600);
	const minutes = Math.floor((remainingSeconds % 3600) / 60);
	const seconds = remainingSeconds % 60;
	const countdown =
		hours > 0
			? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
			: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	const time = new Date(nextRunAt).toLocaleTimeString("zh-CN", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const isToday = new Date(nextRunAt).toDateString() === new Date(now).toDateString();
	const date = isToday ? "" : `${new Date(nextRunAt).toLocaleDateString("zh-CN")} `;
	return {
		countdown:
			remainingSeconds > 0
				? `${countdown} 后${task.retryAttempt ? "重试" : "轮询"}`
				: "等待开始轮询",
		nextPoll: `下次${task.retryAttempt ? "重试" : "轮询"} ${date}${time}`,
	};
}
