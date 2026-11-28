import { useEffect, useState } from "react";

import type { Task } from "../../shared/contracts";
import { getTaskPollingState } from "./task-polling";

interface TaskStatusMetricProps {
	task: Task;
	isCollecting: boolean;
}

export function TaskStatusMetric({ task, isCollecting }: TaskStatusMetricProps) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (task.status !== "running") return;
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [task.id, task.status, task.nextRunAt]);
	const polling = getTaskPollingState(task, isCollecting, now);
	return (
		<div className="metric metric-task-status">
			<span>任务状态</span>
			<div className="metric-task-status-value">
				<strong>
					{task.status === "running"
						? "运行中"
						: task.status === "attention"
							? "需处理"
							: "已暂停"}
				</strong>
				{polling && <span className="metric-poll-countdown">{polling.countdown}</span>}
			</div>
			<small className="metric-next-poll">
				{polling?.nextPoll ??
					(task.status === "attention" ? "处理异常后可恢复轮询" : "恢复运行后继续轮询")}
			</small>
		</div>
	);
}
