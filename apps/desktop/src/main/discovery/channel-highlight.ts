import type { DiscoveryRect } from "../../shared/contracts";
import { resolveChannelRegion } from "./region";

interface HighlightNode {
	content: { role: string; name: string };
	presentation: { bounds: DiscoveryRect; has_bounds: boolean };
	relation: { parent_index: number };
}

// Resolve only visible rows in the uniquely identified channel list, using the
// current native tree and category locator rather than a saved snapshot ref.
export function resolveChannelHighlight(
	window: DiscoveryRect,
	nodes: HighlightNode[],
	channel: { name: string; category: string },
): DiscoveryRect {
	const sidebar = resolveChannelRegion(window, window, nodes);
	const listIndex = nodes.findIndex(
		(node) => node.content.role === "list" && /^(频道|Channels)$/i.test(node.content.name),
	);
	let category = "";
	const matches: DiscoveryRect[] = [];
	const children = new Map<number, number[]>();
	for (const [index, node] of nodes.entries()) {
		const parent = node.relation.parent_index;
		if (parent >= 0 && parent < index)
			children.set(parent, [...(children.get(parent) ?? []), index]);
	}
	// The native FFI tree is breadth-first. Restore document order before
	// applying category headings, including links nested in list-item wrappers.
	const ordered: number[] = [];
	function visit(parent: number, depth: number) {
		if (depth > 50) return;
		for (const index of children.get(parent) ?? []) {
			ordered.push(index);
			visit(index, depth + 1);
		}
	}
	visit(listIndex, 0);
	for (const index of ordered) {
		const node = nodes[index];
		const label = (node.content.name ?? "").replace(/^(?:未读[，,]\s*|Unread[,，]\s*)/i, "");
		if (
			node.content.role === "button" &&
			/[（(](?:类别|category)[）)](?:[,，].*)?$/i.test(label)
		)
			category = label.replace(/\s*[（(](?:类别|category)[）)](?:[,，].*)?$/i, "").trim();
		const name = label
			.match(
				/^(.*?)\s*[（(](?:文字频道|text channel|公告频道|announcement channel|论坛频道|forum channel)[）)](?:\s*[,，].*)?$/i,
			)?.[1]
			.trim();
		if (
			node.content.role !== "link" ||
			name !== channel.name ||
			category !== channel.category ||
			!node.presentation.has_bounds
		)
			continue;
		const bounds = node.presentation.bounds;
		if (
			![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
			bounds.width <= 0 ||
			bounds.height <= 0
		)
			continue;
		const x = Math.max(bounds.x, sidebar.x);
		const y = Math.max(bounds.y, sidebar.y);
		const right = Math.min(bounds.x + bounds.width, sidebar.x + sidebar.width);
		const bottom = Math.min(bounds.y + bounds.height, sidebar.y + sidebar.height);
		if (right - x >= 20 && bottom - y >= 8)
			matches.push({ x, y, width: right - x, height: bottom - y });
	}
	if (matches.length !== 1) throw new Error("当前频道行不可见或不唯一，暂不显示高亮。");
	return matches[0];
}
