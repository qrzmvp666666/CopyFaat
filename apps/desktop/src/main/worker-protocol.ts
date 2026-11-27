import type { DiscoveryRect } from "../shared/contracts";

export interface DesktopWorkerResponse {
	type: "result" | "error" | "ready";
	result?: unknown;
	message?: string;
	bounds?: DiscoveryRect;
}

export function parseDesktopWorkerResponse(value: unknown): DesktopWorkerResponse | undefined {
	if (!value || typeof value !== "object") return undefined;
	const response = value as Record<string, unknown>;
	if (response.type === "ready" && response.bounds && typeof response.bounds === "object")
		return { type: "ready", bounds: response.bounds as DiscoveryRect };
	if (response.type === "result") return { type: "result", result: response.result };
	if (response.type === "error")
		return {
			type: "error",
			message: typeof response.message === "string" ? response.message : undefined,
		};
	return undefined;
}
