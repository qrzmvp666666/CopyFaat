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
