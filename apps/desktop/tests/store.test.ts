import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { createStore } from "../src/main/store";
import { initialState } from "../src/shared/contracts";

it("migrates old global webhooks to channel mappings without overwriting channel addresses", async () => {
	const root = await mkdtemp(join(tmpdir(), "copyfast-migration-"));
	try {
		const path = join(root, "state.json");
		await writeFile(
			path,
			JSON.stringify({
				...initialState(),
				tasks: [
					{
						id: "legacy",
						status: "running",
						receiver: {
							platform: "discord",
							server: { name: "Old server" },
							webhookUrl: "https://discord.com/api/webhooks/123/synthetic-legacy",
							channels: [
								{ sourceChannelId: "a", target: { id: "", name: "A" } },
								{
									sourceChannelId: "b",
									target: { id: "", name: "B" },
									webhookUrl:
										"https://discord.com/api/webhooks/456/synthetic-specific",
								},
							],
						},
					},
				],
			}),
		);
		const store = await createStore(path);
		const task = store.read().tasks[0];
		expect(task.status).toBe("running");
		expect(task.receiver?.channels.map((channel) => channel.webhookUrl)).toEqual([
			"https://discord.com/api/webhooks/123/synthetic-legacy",
			"https://discord.com/api/webhooks/456/synthetic-specific",
		]);
		expect(task.receiver).not.toHaveProperty("webhookUrl");
		expect(task.receiver).not.toHaveProperty("server");
		await store.update(() => {});
		expect((await createStore(path)).read()).toEqual(store.read());
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
