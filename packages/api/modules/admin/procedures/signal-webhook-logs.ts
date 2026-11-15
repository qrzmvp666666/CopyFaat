import { ORPCError } from "@orpc/server";
import {
	getSignalWebhookLog,
	listSignalWebhookLogs,
	SIGNAL_WEBHOOK_LOG_STATUSES,
} from "@repo/database";
import { z } from "zod";

import { adminProcedure } from "../../../orpc/procedures";

export const listWebhookLogs = adminProcedure
	.route({
		method: "GET",
		path: "/admin/signal-webhook-logs",
		tags: ["Administration"],
		summary: "List signal webhook calls",
	})
	.input(
		z.object({
			query: z.string().trim().max(160).optional(),
			status: z.enum(SIGNAL_WEBHOOK_LOG_STATUSES).optional(),
			limit: z.number().int().min(1).max(100).default(20),
			offset: z.number().int().min(0).max(100000).default(0),
		}),
	)
	.handler(async ({ input }) => listSignalWebhookLogs(input));

export const findWebhookLog = adminProcedure
	.route({
		method: "GET",
		path: "/admin/signal-webhook-logs/{id}",
		tags: ["Administration"],
		summary: "Get signal webhook call details",
	})
	.input(z.object({ id: z.string().uuid() }))
	.handler(async ({ input }) => {
		const log = await getSignalWebhookLog(input.id);
		if (!log) throw new ORPCError("NOT_FOUND");
		return log;
	});
