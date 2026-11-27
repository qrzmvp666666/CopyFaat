// Keep foreground loss distinct from a changed server/window or an invalid snapshot.
export function assertDiscordFocused(focused: boolean) {
	if (!focused)
		throw Object.assign(new Error("Discord 已离开前台，已停止继续操作。"), {
			code: "DISCORD_FOCUS_LOST",
		});
}

export function isDiscordFocusLost(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "DISCORD_FOCUS_LOST";
}
