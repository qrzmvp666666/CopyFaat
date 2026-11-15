import { ORPCError } from "@orpc/server";
import { listSignalSourceBindings, saveSignalSourceBinding } from "@repo/database";

import { adminProcedure } from "../../../orpc/procedures";
import { signalSourceBindingSchema } from "../types/signal-source-bindings";

export const listSourceBindings = adminProcedure
	.route({
		method: "GET",
		path: "/admin/signal-source-bindings",
		tags: ["Administration"],
		summary: "List KOL source bindings",
	})
	.handler(async () => listSignalSourceBindings());

export const saveSourceBinding = adminProcedure
	.route({
		method: "POST",
		path: "/admin/signal-source-bindings",
		tags: ["Administration"],
		summary: "Create or edit a KOL source binding",
	})
	.input(signalSourceBindingSchema)
	.handler(async ({ input }) => {
		try {
			return await saveSignalSourceBinding(input);
		} catch (error) {
			const code =
				typeof error === "object" && error !== null && "code" in error
					? error.code
					: undefined;
			if (code === "P2002")
				throw new ORPCError("CONFLICT", { message: "This source already has a binding." });
			if (code === "P2003" || code === "P2025")
				throw new ORPCError("NOT_FOUND", { message: "Binding or KOL no longer exists." });
			if (error instanceof Error && error.message === "EMPTY_SOURCE_NAME")
				throw new ORPCError("BAD_REQUEST", {
					message: "Source names must contain meaningful text.",
				});
			throw error;
		}
	});
