import { z } from "zod";
export const signalSourceBindingSchema = z.object({
	id: z.string().trim().min(1).optional(),
	platform: z.string().trim().min(1).max(80),
	serverName: z.string().trim().min(1).max(160),
	channelName: z.string().trim().min(1).max(160),
	categoryName: z.string().trim().max(160),
	traderId: z.string().trim().min(1),
	isActive: z.boolean(),
});
export type SignalSourceBindingValues = z.infer<typeof signalSourceBindingSchema>;
