import type { DiscoveryRect } from "../../shared/contracts";

interface AccessibleRegionNode {
	content: { role: string; name: string };
	presentation: { bounds: DiscoveryRect; has_bounds: boolean };
}

// Limit scrolling to the uniquely identified sidebar inside the current window scope.
export function resolveChannelRegion(
	scope: DiscoveryRect,
	window: DiscoveryRect,
	nodes: AccessibleRegionNode[],
): DiscoveryRect {
	const matches = nodes.filter(
		(node) =>
			node.content.role === "list" &&
			/^(频道|Channels)$/i.test(node.content.name ?? "") &&
			node.presentation.has_bounds,
	);
	if (matches.length !== 1)
		throw new Error("无法唯一定位频道侧栏，请在 Discord 中打开目标服务器后重试。");
	const sidebar = matches[0].presentation.bounds;
	const x = Math.max(sidebar.x, scope.x, window.x);
	const y = Math.max(sidebar.y, scope.y, window.y);
	const right = Math.min(
		sidebar.x + sidebar.width,
		scope.x + scope.width,
		window.x + window.width,
	);
	const bottom = Math.min(
		sidebar.y + sidebar.height,
		scope.y + scope.height,
		window.y + window.height,
	);
	if (![x, y, right, bottom].every(Number.isFinite) || right - x < 40 || bottom - y < 80)
		throw new Error("所选窗口范围未包含频道侧栏，请选择整个 Discord 窗口后重试。");
	return { x, y, width: right - x, height: bottom - y };
}

// Snapshot refs identify content; coordinates must come from a fresh exact-window tree.
export function resolveMessageRegion(
	window: DiscoveryRect,
	nodes: AccessibleRegionNode[],
	channelName: string,
): DiscoveryRect {
	const matches = nodes.filter(
		(node) =>
			node.content.role === "list" &&
			(node.content.name === `${channelName}中的消息` ||
				node.content.name === `Messages in ${channelName}`),
	);
	if (matches.length !== 1 || !matches[0].presentation.has_bounds)
		throw new Error(`无法安全定位“${channelName}”的消息列表滚动区域。`);
	const bounds = matches[0].presentation.bounds;
	if (
		![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
		bounds.width <= 0 ||
		bounds.height <= 0
	)
		throw new Error(`“${channelName}”的消息列表位置尚未就绪，请重试。`);
	const x = Math.max(bounds.x, window.x);
	const y = Math.max(bounds.y, window.y);
	const right = Math.min(bounds.x + bounds.width, window.x + window.width);
	const bottom = Math.min(bounds.y + bounds.height, window.y + window.height);
	if (![x, y, right, bottom].every(Number.isFinite) || right - x < 40 || bottom - y < 80)
		throw new Error(`“${channelName}”的消息列表不在当前窗口可见范围内。`);
	return { x, y, width: right - x, height: bottom - y };
}
