import { createNotification } from "./create-notification";
import { NOTIFICATION_TYPES } from "./types";

export async function createWelcomeNotification(userId: string) {
	return await createNotification({
		userId,
		type: NOTIFICATION_TYPES.WELCOME,
		data: {
			title: "欢迎使用 SignalFast",
			message: "账户已准备就绪，你可以开始接收交易信号和重要提醒。",
		},
		link: "/",
	});
}
