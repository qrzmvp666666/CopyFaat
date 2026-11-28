import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Message } from "../shared/contracts";

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_FILES = 10;

export function discordAttachmentUrl(value: string): URL | undefined {
	try {
		const url = new URL(value);
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.port ||
			!["cdn.discordapp.com", "media.discordapp.net"].includes(url.hostname) ||
			!/^\/attachments\/\d+\/\d+\/[^/]+$/.test(url.pathname)
		)
			return undefined;
		return url;
	} catch {
		return undefined;
	}
}

export interface CachedMediaFile {
	path: string;
	name: string;
	contentType: string;
	bytes: Uint8Array;
}

export async function cacheMessageMedia(
	directory: string,
	message: Message,
	signal: AbortSignal,
	request: typeof fetch = fetch,
): Promise<CachedMediaFile[]> {
	if (message.attachments.length > MAX_MEDIA_FILES)
		throw new Error(`单条消息超过 ${MAX_MEDIA_FILES} 个附件，已停止发送以避免漏传。`);
	const files: CachedMediaFile[] = [];
	let totalBytes = 0;
	for (const attachment of message.attachments) {
		signal.throwIfAborted();
		const url = discordAttachmentUrl(attachment.url);
		if (!url) throw new Error("附件地址不是受支持的 Discord 原文件地址。");
		const key = createHash("sha256")
			.update(`${message.key}:${url.hostname}${url.pathname}`)
			.digest("hex");
		const path = join(directory, `${key}.bin`);
		const metadataPath = join(directory, `${key}.json`);
		let bytes: Uint8Array | undefined;
		let contentType = "application/octet-stream";
		try {
			const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
				sha256: string;
				contentType: string;
			};
			const stored = await readFile(path);
			if (
				stored.length <= MAX_MEDIA_BYTES &&
				createHash("sha256").update(stored).digest("hex") === metadata.sha256
			) {
				bytes = stored;
				contentType = metadata.contentType;
			}
		} catch {
			// An absent or incomplete cache is safely downloaded again before sending.
		}
		if (!bytes) {
			const response = await request(url, {
				redirect: "error",
				signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
			});
			if (!response.ok)
				throw new Error(`附件下载失败（HTTP ${response.status}）；未发送本条消息。`);
			if (!response.body) throw new Error("附件下载没有返回文件内容。");
			const chunks: Uint8Array[] = [];
			let size = 0;
			const reader = response.body.getReader();
			try {
				if (Number(response.headers.get("content-length")) > MAX_MEDIA_BYTES - totalBytes)
					throw new Error("单条消息附件总量超过本地 20 MB 上限，未发送本条消息。");
				for (;;) {
					const chunk = await reader.read();
					if (chunk.done) break;
					size += chunk.value.byteLength;
					if (size + totalBytes > MAX_MEDIA_BYTES)
						throw new Error("单条消息附件总量超过本地 20 MB 上限，未发送本条消息。");
					chunks.push(chunk.value);
				}
			} finally {
				await reader.cancel().catch(() => {});
				reader.releaseLock();
			}
			if (!size) throw new Error("附件文件为空，未发送本条消息。");
			contentType =
				response.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
			if (/^(?:text\/|application\/(?:json|xhtml))/i.test(contentType))
				throw new Error("附件地址返回了网页或错误内容，未发送本条消息。");
			bytes = Buffer.concat(chunks);
			await mkdir(directory, { recursive: true, mode: 0o700 });
			const temporary = `${path}.${randomUUID()}.tmp`;
			try {
				await writeFile(temporary, bytes, { mode: 0o600 });
				await rename(temporary, path);
				await writeFile(
					metadataPath,
					JSON.stringify({
						taskId: message.taskId,
						channelId: message.channelId,
						messageId: message.id,
						url: url.href,
						name: attachment.name,
						path,
						contentType,
						sha256: createHash("sha256").update(bytes).digest("hex"),
					}),
					{ mode: 0o600 },
				);
			} finally {
				await rm(temporary, { force: true });
			}
		}
		totalBytes += bytes.byteLength;
		if (totalBytes > MAX_MEDIA_BYTES)
			throw new Error("单条消息附件总量超过本地 20 MB 上限，未发送本条消息。");
		const name =
			Array.from(attachment.name, (character) =>
				character.charCodeAt(0) < 32 || character === "/" || character === "\\"
					? "_"
					: character,
			)
				.join("")
				.slice(0, 200) || "attachment";
		files.push({ path, name, contentType, bytes });
	}
	return files;
}

export async function removeCachedMedia(files: CachedMediaFile[]): Promise<void> {
	await Promise.all(
		files.flatMap((file) => [
			rm(file.path, { force: true }),
			rm(file.path.replace(/\.bin$/, ".json"), { force: true }),
		]),
	);
}
