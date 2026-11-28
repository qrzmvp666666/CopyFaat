import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { cacheMessageMedia, discordAttachmentUrl, MAX_MEDIA_BYTES } from "../src/main/media-cache";
import type { Message } from "../src/shared/contracts";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(directories.map((path) => rm(path, { recursive: true, force: true })));
	directories.length = 0;
});
export const mediaMessage = {
	key: "task:123:456",
	taskId: "task",
	id: "456",
	channelId: "123",
	attachments: [
		{
			url: "https://cdn.discordapp.com/attachments/123/456/chart.jpg?ex=abc&hm=def",
			name: "chart.jpg",
			kind: "image",
		},
	],
} as Message;

async function directory() {
	const path = await mkdtemp(join(tmpdir(), "copyfast-media-test-"));
	directories.push(path);
	return path;
}

describe("Discord media cache", () => {
	it("rejects non-CDN URLs and local files before making a request", async () => {
		for (const url of [
			"file:///etc/passwd",
			"https://localhost/attachments/123/456/a",
			"https://cdn.discordapp.com.evil.test/attachments/123/456/a",
			"https://user@cdn.discordapp.com/attachments/123/456/a",
		])
			expect(discordAttachmentUrl(url)).toBeUndefined();
		const request = vi.fn();
		await expect(
			cacheMessageMedia(
				await directory(),
				{
					...mediaMessage,
					attachments: [{ ...mediaMessage.attachments[0], url: "file:///etc/passwd" }],
				},
				new AbortController().signal,
				request,
			),
		).rejects.toThrow("原文件地址");
		expect(request).not.toHaveBeenCalled();
	});

	it("persists the original file and reuses it even if the signed URL expires", async () => {
		const root = await directory();
		const request = vi.fn(
			async () =>
				new Response(new Uint8Array([255, 216, 255, 1]), {
					headers: { "content-type": "image/jpeg" },
				}),
		);
		const first = await cacheMessageMedia(
			root,
			mediaMessage,
			new AbortController().signal,
			request,
		);
		const second = await cacheMessageMedia(
			root,
			{
				...mediaMessage,
				attachments: [
					{
						...mediaMessage.attachments[0],
						url: mediaMessage.attachments[0].url.replace("abc", "expired"),
					},
				],
			},
			new AbortController().signal,
			request,
		);
		expect(first[0].bytes).toEqual(second[0].bytes);
		expect(request).toHaveBeenCalledOnce();
		expect(await readdir(root)).toHaveLength(2);
	});

	it("rejects oversized and HTML responses without caching a false attachment", async () => {
		const root = await directory();
		for (const response of [
			new Response("x", { headers: { "content-length": String(MAX_MEDIA_BYTES + 1) } }),
			new Response("<html>error</html>", { headers: { "content-type": "text/html" } }),
		]) {
			await expect(
				cacheMessageMedia(
					root,
					mediaMessage,
					new AbortController().signal,
					async () => response,
				),
			).rejects.toThrow();
		}
		expect(await readdir(root)).toEqual([]);
	});
});
