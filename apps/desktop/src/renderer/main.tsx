import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./ui/App";
import { DiscoveryOverlay } from "./ui/DiscoveryOverlay";
import { TaskActivityOverlay } from "./ui/TaskActivityOverlay";

import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		{window.location.hash === "#discovery-overlay" ? (
			<DiscoveryOverlay />
		) : window.location.hash === "#task-activity-overlay" ? (
			<TaskActivityOverlay />
		) : (
			<App />
		)}
	</StrictMode>,
);
