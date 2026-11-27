import { describe, expect, it } from "vitest";

import { getChannels, getChannelLogs, messageInChannel } from "../src/renderer/ui/channel-view";
import { initialState, type Message, type TaskLog } from "../src/shared/contracts";
const message: Message = {
	id: "1",
	key: "a:c:1",
	taskId: "a",
	taskName: "任务 A",
	channelId: "c",
	channelName: "频道 C",
	author: "Ada",
	text: "text",
	sentAt: "2026-11-25T00:00:00Z",
	collectedAt: "2026-11-25T00:00:00Z",
	attachments: [],
	mediaLabels: [],
	batchId: "batch",
	status: "collected",
	attempts: 0,
};
const log: TaskLog = {
	id: "batch",
	taskId: "a",
	phase: "collect",
	status: "success",
	startedAt: message.collectedAt,
	collected: 5,
	saved: 5,
	ignored: 0,
	failed: 0,
	messageKeys: [message.key],
};
describe("channel browsing", () => {
	it("isolates identical channel ids belonging to different tasks", () => {
		const state = initialState();
		state.messages = [message, { ...message, taskId: "b", key: "b:c:1" }];
		const channels = getChannels(state);
		expect(channels).toHaveLength(2);
		expect(channels[0].count).toBe(1);
		expect(messageInChannel(state.messages[1], channels[0])).toBe(false);
	});
	it("labels historical task totals without fabricating channel results", () => {
		const state = initialState();
		state.messages = [message];
		state.logs = [log];
		const rows = getChannelLogs(state, "a", getChannels(state)[0]);
		expect(rows[0].legacy).toBe(true);
		expect(rows[0].result).toBeUndefined();
		expect(rows[0].log.saved).toBe(5);
	});
	it("retains empty historical channels and scopes each batch to its channel", () => {
		const state = initialState();
		state.logs = [
			{
				...log,
				channelResults: [
					{
						channelId: "empty",
						channelName: "空频道",
						status: "skipped",
						collected: 0,
						saved: 0,
						ignored: 0,
						failed: 0,
					},
				],
			},
		];
		const channels = getChannels(state);
		expect(channels[0].count).toBe(0);
		expect(getChannelLogs(state, undefined, channels[0])[0]).toMatchObject({
			legacy: false,
			status: "skipped",
			result: { saved: 0 },
		});
	});
	it("does not attach unrelated old batches to the selected channel", () => {
		const state = initialState();
		state.messages = [message];
		state.logs = [{ ...log, id: "other", messageKeys: [] }];
		expect(getChannelLogs(state, "a", getChannels(state)[0])).toHaveLength(0);
	});
});
