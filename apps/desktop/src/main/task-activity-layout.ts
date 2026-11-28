import type { DiscoveryRect } from "../shared/contracts";

export function relativeChannelHighlight(
	row: DiscoveryRect | undefined,
	viewport: DiscoveryRect,
	window: DiscoveryRect | undefined,
): DiscoveryRect | undefined {
	if (!row || !window) return undefined;
	if (
		![row, viewport, window].every(
			(rect) =>
				[rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) &&
				rect.width > 0 &&
				rect.height > 0,
		)
	)
		return undefined;
	const x = Math.max(row.x, viewport.x, window.x);
	const y = Math.max(row.y, viewport.y, window.y);
	const right = Math.min(row.x + row.width, viewport.x + viewport.width, window.x + window.width);
	const bottom = Math.min(
		row.y + row.height,
		viewport.y + viewport.height,
		window.y + window.height,
	);
	if (right - x < 20 || bottom - y < 8) return undefined;
	return { x: x - viewport.x, y: y - viewport.y, width: right - x, height: bottom - y };
}
