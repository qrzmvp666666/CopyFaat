import type { SendEmailHandler } from "../types";
import { send as sendToConsole } from "./console";

export const send: SendEmailHandler = async (params) => {
	if (!process.env.RESEND_API_KEY) {
		return sendToConsole(params);
	}

	const { send: sendWithResend } = await import("./resend");

	return sendWithResend(params);
};
