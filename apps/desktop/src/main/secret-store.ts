import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { safeStorage } from "electron";

type SecretMap = Record<string, string>;

export async function createSecretStore(path: string) {
	await mkdir(dirname(path), { recursive: true });
	let secrets: SecretMap = {};
	try {
		secrets = JSON.parse(await readFile(path, "utf8")) as SecretMap;
	} catch {}
	return {
		get(id: string) {
			const encoded = secrets[id];
			if (!encoded || !safeStorage.isEncryptionAvailable()) return undefined;
			return safeStorage.decryptString(Buffer.from(encoded, "base64"));
		},
		async set(id: string, value: string) {
			if (!safeStorage.isEncryptionAvailable())
				throw new Error("当前系统暂不支持安全保存密钥");
			secrets[id] = safeStorage.encryptString(value).toString("base64");
			await writeFile(path, JSON.stringify(secrets), { mode: 0o600 });
			await chmod(path, 0o600);
		},
	};
}
