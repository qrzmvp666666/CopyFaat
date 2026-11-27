import { z } from "zod";

export const platformSchema = z.enum(["discord", "telegram"]);
export const channelSchema = z.object({
	id: z.string().min(1).max(200),
	name: z.string().min(1).max(160),
	identity: z.enum(["discord", "local"]).optional(),
	locator: z
		.object({
			serverName: z.string().max(160),
			category: z.string().max(160),
			channelName: z.string().max(160),
		})
		.optional(),
});
export type Channel = z.infer<typeof channelSchema>;
export const scopeSchema = z.object({
	platform: platformSchema,
	server: channelSchema,
	channels: z
		.array(channelSchema)
		.min(1)
		.max(500)
		.refine((value) => new Set(value.map((c) => c.id)).size === value.length, "频道不能重复"),
});
export const discordWebhookUrlSchema = z
	.string()
	.trim()
	.max(2048)
	.refine((value) => {
		try {
			const url = new URL(value);
			return (
				url.protocol === "https:" &&
				url.host === "discord.com" &&
				!url.username &&
				!url.password &&
				!url.search &&
				!url.hash &&
				/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
			);
		} catch {
			return false;
		}
	}, "请填写有效的 Discord Webhook 地址");
export const receiverSchema = z.object({
	platform: z.literal("discord"),
	channels: z
		.array(
			z.object({
				sourceChannelId: z.string().min(1).max(200),
				webhookUrl: discordWebhookUrlSchema,
				target: z.object({
					id: z.string().trim().max(200),
					name: z.string().trim().min(1).max(160),
				}),
			}),
		)
		.min(1)
		.max(500),
});
export type Receiver = z.infer<typeof receiverSchema>;

export const taskInputSchema = z
	.object({
		name: z.string().trim().min(1).max(80),
		startPaused: z.boolean().optional(),
		receiver: receiverSchema.optional(),
		source: scopeSchema,
		// Only retained for previously saved script-backed tasks, never requested by the wizard.
		collector: z
			.object({
				executable: z.string().min(1),
				args: z.array(z.string()).max(30).default([]),
			})
			.optional(),
		rules: z.object({
			intervalSeconds: z.number().int().min(10).max(86400),
			startAt: z.iso.datetime(),
			markRead: z.boolean().default(true),
			include: z.string().max(500).default(""),
			exclude: z.string().max(500).default(""),
			maxRetries: z.number().int().min(0).max(5).default(3),
			retrySeconds: z.number().int().min(5).max(3600).default(10),
			text: z.boolean().default(true),
			images: z.boolean().default(true),
			attachments: z.boolean().default(true),
		}),
	})
	.superRefine((task, context) => {
		if (!task.receiver) return;
		const sourceIds = new Set(task.source.channels.map((channel) => channel.id));
		const mappedIds = new Set(task.receiver.channels.map((channel) => channel.sourceChannelId));
		if (
			mappedIds.size !== task.receiver.channels.length ||
			mappedIds.size !== sourceIds.size ||
			[...mappedIds].some((id) => !sourceIds.has(id))
		) {
			context.addIssue({
				code: "custom",
				path: ["receiver", "channels"],
				message: "接收对应关系必须与所选来源频道一一对应",
			});
		}
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
	mediaLabels: z
		.array(z.object({ kind: z.enum(["image", "file"]), label: z.string().max(300) }))
		.max(30)
		.default([]),
	signal: z.record(z.string(), z.unknown()).optional(),
});
export const collectorResponseSchema = z.object({
	version: z.literal(1),
	messages: z.array(collectedMessageSchema).max(500),
	cursor: z.string().max(4000).optional(),
	channels: z
		.array(
			z.object({
				channelId: z.string().min(1).max(200),
				status: z.enum(["unread", "skipped_read", "failed"]),
				collected: z.number().int().nonnegative(),
				error: z.string().max(1000).optional(),
			}),
		)
		.max(500)
		.default([]),
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
	status:
		| "processing"
		| "success"
		| "skipped"
		| "skipped_read"
		| "retrying"
		| "failed"
		| "uncertain";
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
export interface DiscoveryRect {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface DiscoveryProgress {
	phase: "preparing" | "selecting" | "countdown" | "scanning" | "paused";
	found: number;
	message: string;
	serverName?: string;
	channelNames?: string[];
}
export interface DiscoveryResult {
	scope: Scope;
	complete: boolean;
	message: string;
}
export interface DiscoveryOverlayState {
	bounds: DiscoveryRect;
	progress: DiscoveryProgress;
}
export interface TaskActivityState {
	taskName: string;
	phase: "collect" | "send" | "mark-read";
	windowBounds?: DiscoveryRect;
}
export interface DesktopApi {
	discoverDiscordChannels(): Promise<DiscoveryResult | null>;
	cancelDiscovery(): Promise<void>;
	resolveDiscoveryExit(continueScanning: boolean): Promise<void>;
	discoveryOverlayState(): Promise<DiscoveryOverlayState | null>;
	onDiscoveryProgress(callback: (progress: DiscoveryProgress) => void): () => void;
	onTaskActivity(callback: (activity: TaskActivityState | null) => void): () => void;
	taskActivityState(): Promise<TaskActivityState | null>;
	state(): Promise<PublicState>;
	runtime(): Promise<RuntimeInfo>;
	saveTask(input: TaskInput, id?: string): Promise<string>;
	taskAction(id: string, action: "pause" | "resume" | "run"): Promise<void>;
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
