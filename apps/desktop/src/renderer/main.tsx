import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./ui/App";
import { DiscoveryOverlay } from "./ui/DiscoveryOverlay";

import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		{window.location.hash === "#discovery-overlay" ? <DiscoveryOverlay /> : <App />}
	</StrictMode>,
);
