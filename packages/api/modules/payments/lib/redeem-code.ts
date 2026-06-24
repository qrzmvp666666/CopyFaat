import { createHash, randomBytes } from "node:crypto";

const REDEEM_CODE_PREFIX = "FS";

export function createRedeemCode() {
	const body = randomBytes(12).toString("base64url").toUpperCase().replaceAll("_", "A");
	const compact = `${REDEEM_CODE_PREFIX}${body}`.replace(/[^A-Z0-9]/g, "").slice(0, 18);

	return compact.match(/.{1,6}/g)?.join("-") ?? compact;
}

export function normalizeRedeemCode(code: string) {
	return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRedeemCode(code: string) {
	return createHash("sha256").update(normalizeRedeemCode(code)).digest("hex");
}
