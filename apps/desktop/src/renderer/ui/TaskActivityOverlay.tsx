import { useEffect, useState } from "react";

import type { TaskActivityState } from "../../shared/contracts";

import "./task-activity-overlay.css";

const PHASE_LABELS: Record<TaskActivityState["phase"], string> = {
	collect: "正在检查未读频道并采集新消息",
	send: "正在发送新消息到对应 Webhook",
	"mark-read": "正在滚动到最新消息",
};

export function TaskActivityOverlay() {
	const [activity, setActivity] = useState<TaskActivityState | null>(null);

	useEffect(() => {
		document.documentElement.classList.add("task-activity-document");
		let active = true;
		const unsubscribe = window.copyfast.onTaskActivity(setActivity);
		void window.copyfast.taskActivityState().then((state) => {
			if (active) setActivity(state);
		});
		return () => {
			active = false;
			unsubscribe();
			document.documentElement.classList.remove("task-activity-document");
		};
	}, []);

	if (!activity) return null;
	return (
		<div className="task-activity-overlay" role="status" aria-live="polite">
			<span className="task-activity-indicator" aria-hidden="true" />
			<div className="task-activity-copy">
				<strong>{PHASE_LABELS[activity.phase]}</strong>
				<span>{activity.taskName}</span>
			</div>
		</div>
	);
}
