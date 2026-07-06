import { listStoredSignals } from "@signals/lib/signal-store";
import type { SignalsListResponse } from "@signals/lib/signal-types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const searchParamsSchema = z.object({
	cursor: z.string().optional(),
	direction: z.enum(["long", "short"]).optional(),
	entryStatus: z.enum(["pending", "entered"]).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(200),
	sourceIds: z.array(z.string().trim().min(1).max(160)).default([]),
	status: z.enum(["active", "history"]).optional(),
	submittedAfter: z.coerce.date().optional(),
	symbol: z
		.string()
		.trim()
		.min(3)
		.max(24)
		.transform((symbol) => symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
		.optional(),
});

export async function GET(request: Request) {
	const searchParams = new URL(request.url).searchParams;
	const sourceIds = searchParams
		.getAll("sourceIds")
		.flatMap((value) => value.split(","))
		.map((value) => value.trim())
		.filter(Boolean);
	const parsed = searchParamsSchema.safeParse({
		cursor: searchParams.get("cursor") ?? undefined,
		direction: searchParams.get("direction") ?? undefined,
		entryStatus: searchParams.get("entryStatus") ?? undefined,
		limit: searchParams.get("limit") ?? undefined,
		sourceIds,
		status: searchParams.get("status") ?? undefined,
		submittedAfter: searchParams.get("submittedAfter") ?? undefined,
		symbol: searchParams.get("symbol") ?? undefined,
	});

	if (!parsed.success) {
		return NextResponse.json(
			{
				error: "Invalid signals query.",
				issues: parsed.error.flatten(),
				ok: false,
			},
			{ status: 422 },
		);
	}

	const response: SignalsListResponse = await listStoredSignals(parsed.data);

	return NextResponse.json(response, {
		headers: {
			"Cache-Control": "no-store",
		},
	});
}
