import { z } from "zod";

export const platformSchema = z.enum(["discord", "telegram"]);
export const channelSchema = z.object({
	id: z.string().min(1).max(200),
	name: z.string().min(1).max(160),
});
export const scopeSchema = z.object({
	platform: platformSchema,
	server: channelSchema,
	channels: z
		.array(channelSchema)
		.min(1)
		.max(100)
		.refine((value) => new Set(value.map((c) => c.id)).size === value.length, "频道不能重复"),
});
export const taskInputSchema = z.object({
	name: z.string().trim().min(1).max(80),
	source: scopeSchema,
	collector: z.object({
		executable: z.string().min(1),
		args: z.array(z.string()).max(30).default([]),
	}),
	rules: z.object({
		intervalSeconds: z.number().int().min(10).max(86400),
		startAt: z.iso.datetime(),
		include: z.string().max(500).default(""),
		exclude: z.string().max(500).default(""),
		maxRetries: z.number().int().min(0).max(5).default(3),
		retrySeconds: z.number().int().min(5).max(3600).default(10),
		text: z.boolean().default(true),
		images: z.boolean().default(true),
		attachments: z.boolean().default(true),
	}),
});
export type Platform = z.infer<typeof platformSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export interface Task extends TaskInput {
	id: string;
	status: "running" | "paused" | "attention";
	cursor?: string;
	retryAttempt?: number;
	lastRunAt?: string;
	nextRunAt: string;
	error?: string;
	createdAt: string;
}
export const collectedMessageSchema = z.object({
	id: z.string().min(1).max(240),
	channelId: z.string().min(1).max(200),
	author: z.string().max(160),
	text: z.string().max(32000),
	sentAt: z.iso.datetime(),
	attachments: z
		.array(
			z.object({ url: z.url(), name: z.string().max(250), kind: z.enum(["image", "file"]) }),
		)
		.max(20)
		.default([]),
	signal: z.record(z.string(), z.unknown()).optional(),
});
export const collectorResponseSchema = z.object({
	version: z.literal(1),
	messages: z.array(collectedMessageSchema).max(500),
	cursor: z.string().max(4000).optional(),
});
export type CollectedMessage = z.infer<typeof collectedMessageSchema>;
export type CollectorResponse = z.infer<typeof collectorResponseSchema>;
export interface Message extends CollectedMessage {
	key: string;
	taskId: string;
	taskName?: string;
	platform?: Platform;
	sourceName?: string;
	channelName?: string;
	batchId: string;
	collectedAt: string;
	status: "collected" | "pending" | "sending" | "synced" | "failed" | "uncertain" | "filtered";
	attempts: number;
	nextAttemptAt?: string;
	syncedAt?: string;
	error?: string;
	remoteLogId?: string;
}
export interface ChannelResult {
	channelId: string;
	channelName: string;
	status: "processing" | "success" | "skipped" | "failed" | "uncertain";
	collected: number;
	saved: number;
	ignored: number;
	failed: number;
	error?: string;
}
export interface TaskLog {
	channelResults?: ChannelResult[];
	taskName?: string;
	sourceName?: string;
	platform?: Platform;
	attempt?: number;
	retryAt?: string;
	channelIds?: string[];
	id: string;
	taskId: string;
	phase: "collect" | "sync" | "settings";
	status: "processing" | "success" | "partial" | "failed" | "uncertain";
	startedAt: string;
	finishedAt?: string;
	durationMs?: number;
	collected: number;
	saved: number;
	ignored: number;
	failed: number;
	messageKeys: string[];
	error?: string;
	httpStatus?: number;
	remoteLogId?: string;
}
export interface AppState {
	version: 1;
	tasks: Task[];
	messages: Message[];
	logs: TaskLog[];
}
export type PublicTask = Task;
export interface PublicState extends Omit<AppState, "tasks"> {
	tasks: PublicTask[];
}
export const initialState = (): AppState => ({ version: 1, tasks: [], messages: [], logs: [] });
export interface RuntimeInfo {
	platform: string;
	version: string;
	permissions: { accessibility: boolean; screen: string };
	systemSupported: boolean;
	apps: { telegram: boolean; discord: boolean };
}
export interface DesktopApi {
	state(): Promise<PublicState>;
	runtime(): Promise<RuntimeInfo>;
	saveTask(input: TaskInput, id?: string): Promise<string>;
	taskAction(id: string, action: "pause" | "resume" | "run"): Promise<void>;
	chooseCollector(): Promise<string | null>;
	deleteTask(id: string): Promise<void>;
	launchDesktopApp(target: "telegram" | "discord"): Promise<boolean>;
	requestAccessibilityPermission(): Promise<boolean>;
	openExternal(target: "telegram" | "discord" | "support" | "permissions"): Promise<void>;
	showWorkspace(taskId?: string, tab?: string): Promise<void>;
	windowAction(action: "minimize" | "maximize" | "close"): Promise<void>;
	onState(callback: (state: PublicState) => void): () => void;
	onNavigate(callback: (target: { taskId?: string; tab?: string }) => void): () => void;
}
declare global {
	interface Window {
		copyfast: DesktopApi;
	}
}
