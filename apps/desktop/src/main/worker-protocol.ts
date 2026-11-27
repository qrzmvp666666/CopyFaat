export interface DesktopWorkerResponse {
	type: "result" | "error";
	result?: unknown;
	message?: string;
}

export function parseDesktopWorkerResponse(value: unknown): DesktopWorkerResponse | undefined {
	if (!value || typeof value !== "object") return undefined;
	const response = value as Record<string, unknown>;
	if (response.type === "result") return { type: "result", result: response.result };
	if (response.type === "error")
		return {
			type: "error",
			message: typeof response.message === "string" ? response.message : undefined,
		};
	return undefined;
}
