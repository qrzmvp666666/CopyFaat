import { z } from "zod";

import type { DiscoveryRect, TaskChannelProgress } from "../shared/contracts";

export interface DesktopWorkerResponse {
	type: "result" | "error" | "ready" | "progress" | "media-clipboard";
	id?: string;
	phase?: "begin" | "read" | "restore";
	result?: unknown;
	message?: string;
	bounds?: DiscoveryRect;
	channel?: TaskChannelProgress;
}

const channelProgressSchema = z
	.object({
		channelId: z.string().min(1).max(500),
		channelName: z.string().min(1).max(500),
		index: z.number().int().positive(),
		total: z.number().int().positive(),
		status: z.enum(["locating", "scanning", "skipped-read"]),
		bounds: z
			.object({
				x: z.number().finite(),
				y: z.number().finite(),
				width: z.number().positive().finite(),
				height: z.number().positive().finite(),
			})
			.optional(),
	})
	.refine((value) => value.index <= value.total);

export function parseDesktopWorkerResponse(value: unknown): DesktopWorkerResponse | undefined {
	if (!value || typeof value !== "object") return undefined;
	const response = value as Record<string, unknown>;
	if (response.type === "media-clipboard") {
		if (
			typeof response.id !== "string" ||
			!/^[0-9a-f-]{36}$/.test(response.id) ||
			!["begin", "read", "restore"].includes(String(response.phase))
		)
			return undefined;
		return {
			type: "media-clipboard",
			id: response.id,
			phase: response.phase as "begin" | "read" | "restore",
		};
	}
	if (response.type === "progress") {
		const parsed = channelProgressSchema.safeParse(response.channel);
		return parsed.success ? { type: "progress", channel: parsed.data } : undefined;
	}
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
